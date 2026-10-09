<?php
namespace Annoudio\Site\BlockLayout;

use Annoudio\Stack;
use Annoudio\StackError;
use Laminas\Form\Element;
use Laminas\View\Renderer\PhpRenderer;
use Omeka\Api\Representation\MediaRepresentation;
use Omeka\Api\Representation\SitePageBlockRepresentation;
use Omeka\Api\Representation\SitePageRepresentation;
use Omeka\Api\Representation\SiteRepresentation;
use Omeka\Entity\SitePageBlock;
use Omeka\Site\BlockLayout\AbstractBlockLayout;
use Omeka\Stdlib\ErrorStore;

/**
 * The "Annoudio player" page block. It prints the snippet of CONTRACT.md 1.
 *
 * The block stores data only (the recording id, a copy of the admin's audio address, an
 * optional attached Omeka media), never HTML. PHP renders the element and adds the loader
 * through headScript, so the HTML purifier never sees them.
 *
 * The audio address, in order: the attached media's original file; the admin's address
 * at render time (CONTRACT.md 5.2, cached for Stack::CACHE_SECONDS); the stored copy,
 * when this server cannot reach the stack.
 */
class Player extends AbstractBlockLayout
{
    public function __construct(private readonly Stack $stack)
    {
    }

    public function getLabel()
    {
        return 'Annoudio player'; // @translate
    }

    public function form(PhpRenderer $view, SiteRepresentation $site,
        ?SitePageRepresentation $page = null, ?SitePageBlockRepresentation $block = null
    ) {
        $recording = new Element\Text('o:block[__blockIndex__][o:data][recording]');
        $recording->setOptions([
            'label' => 'Recording ID', // @translate
            'info' => 'A number, for example 1. The Snippet panel of the recording in the Annoudio admin shows it: "Recording ID: 1". The block gets the title and the audio address from the Annoudio admin.', // @translate
        ]);
        // An id makes the label and the description of each block unique.
        $recording->setAttributes(['required' => true, 'id' => 'annoudio-recording-__blockIndex__', 'inputmode' => 'numeric']);
        $recording->setValue($block ? (string) $block->dataValue('recording', '') : '');

        // The stored copy of the admin's audio address goes back with the form, so that a
        // save while the stack is down keeps it (onHydrate).
        $src = new Element\Hidden('o:block[__blockIndex__][o:data][src]');
        $src->setValue($block ? (string) $block->dataValue('src', '') : '');

        $html = $this->status($view, $block);
        $html .= $view->formRow($recording);
        $html .= $view->formHidden($src);
        $html .= '<h4>' . $view->escapeHtml($view->translate('Omeka media (optional)')) . '</h4>';
        $html .= '<p>' . $view->escapeHtml($view->translate('Attach the media only when it is the same audio file as the recording in the Annoudio admin. The block then plays the Omeka file.')) . '</p>';
        $html .= $view->blockAttachmentsForm($block, false, [], 1);
        return $html;
    }

    public function onHydrate(SitePageBlock $block, ErrorStore $errorStore)
    {
        $data = $block->getData();
        $recording = trim((string) ($data['recording'] ?? ''));
        $src = trim((string) ($data['src'] ?? ''));
        if ($src !== '' && !preg_match('~^https?://\S+$~i', $src)) {
            $src = '';
        }

        if ($recording === '') {
            $errorStore->addError('o:block', 'Annoudio player: type the recording ID.'); // @translate
        }
        $media = null;
        foreach ($block->getAttachments() as $attachment) {
            $media = $attachment->getMedia() ?? $media;
        }
        if ($media !== null && $media->hasOriginal() && !str_starts_with((string) $media->getMediaType(), 'audio/')) {
            $errorStore->addError('o:block', 'Annoudio player: the attached media is not audio. Attach an audio media, or remove the attachment.'); // @translate
        }
        // A recording that the stack does not know is a sure error. Other failures
        // (stack down, server cannot reach it) do not block the save: the stored copy stays.
        if ($recording !== '' && $this->stack->isConfigured()) {
            try {
                $src = $this->stack->recording($recording)['url'];
            } catch (StackError $e) {
                if ($e->kind === StackError::NOT_FOUND || $e->kind === StackError::BAD_RECORDING) {
                    $errorStore->addError('o:block', 'Annoudio player: ' . $e->getMessage());
                }
            }
        }
        $block->setData(['recording' => $recording, 'src' => $src]);
    }

    public function prepareRender(PhpRenderer $view)
    {
        // Omeka calls this once per block layout per page; headScript also drops a duplicate src.
        if ($this->stack->isConfigured()) {
            $view->headScript()->appendFile($this->stack->loaderUrl(), 'text/javascript', ['async' => true]);
        }
    }

    public function render(PhpRenderer $view, SitePageBlockRepresentation $block)
    {
        $recording = (string) $block->dataValue('recording', '');
        if (!$this->stack->isConfigured() || $recording === '') {
            return '';
        }
        $src = $this->src($block);
        if (!preg_match('~^https?://~i', $src)) {
            return '';
        }
        return $view->partial('common/block-layout/annoudio-player', [
            'project' => $this->stack->project,
            'recording' => $recording,
            'src' => $src,
        ]);
    }

    /** The attached media's original file, else the admin's address, else the stored copy. */
    private function src(SitePageBlockRepresentation $block): string
    {
        foreach ($block->attachments() as $attachment) {
            $media = $attachment->media();
            if ($media instanceof MediaRepresentation && $media->hasOriginal()) {
                return (string) $media->originalUrl();
            }
        }
        $found = $this->stack->cachedRecording((string) $block->dataValue('recording', ''));
        return $found !== null ? $found['url'] : (string) $block->dataValue('src', '');
    }

    /** One line above the form: the recording title from the stack, or the problem. */
    private function status(PhpRenderer $view, ?SitePageBlockRepresentation $block): string
    {
        $recording = $block ? (string) $block->dataValue('recording', '') : '';
        if (!$this->stack->isConfigured()) {
            $text = $view->translate('Annoudio is not set up. A global administrator must type the stack address and the project in Modules, Annoudio, Configure.');
            $class = 'error';
        } elseif ($recording === '') {
            return '';
        } else {
            try {
                $text = sprintf($view->translate('Recording found: %s'), $this->stack->recording($recording)['title']);
                $class = 'success';
            } catch (StackError $e) {
                $text = $e->getMessage();
                $class = 'error';
            }
        }
        return sprintf('<p class="annoudio-status messages"><span class="%s">%s</span></p>', $class, $view->escapeHtml($text));
    }
}
