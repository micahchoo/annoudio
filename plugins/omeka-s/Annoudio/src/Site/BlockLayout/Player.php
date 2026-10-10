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
 * The "Annoudio widget" page block (the class keeps its old name: pages store the layout
 * name `annoudioPlayer`). It prints the snippet of CONTRACT.md 1.
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
        return 'Annoudio widget'; // @translate
    }

    public function form(PhpRenderer $view, SiteRepresentation $site,
        ?SitePageRepresentation $page = null, ?SitePageBlockRepresentation $block = null
    ) {
        $recording = new Element\Text('o:block[__blockIndex__][o:data][recording]');
        $recording->setOptions([
            'label' => 'Recording number', // @translate
            'info' => 'A number, for example 1. The Snippet panel of the recording in the Annoudio admin shows it: "Recording number: 1". The block gets the title and the audio address from the Annoudio admin.', // @translate
        ]);
        // An id makes the label and the description of each block unique.
        // `data-annoudio-check`: the address of the check, for the script below.
        $recording->setAttributes([
            'required' => true,
            'id' => 'annoudio-recording-__blockIndex__',
            'inputmode' => 'numeric',
            'data-annoudio-check' => $view->url('admin/annoudio-recording'),
        ]);
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
        $html .= self::CHECK_SCRIPT;
        return $html;
    }

    /**
     * When the number field changes (on blur), ask the module's check and write the status
     * line, so the block says "Recording found" before a save (recordings audit, 18). Once
     * per page: a block form that comes later by XHR runs the script again, and the flag
     * stops it. Plain ES5, as the WordPress block.
     */
    private const CHECK_SCRIPT = <<<'HTML'
<script>
(function () {
    if (window.annoudioCheck) { return; }
    window.annoudioCheck = true;
    document.addEventListener('change', function (event) {
        var input = event.target;
        if (!input || !input.matches || !input.matches('input[data-annoudio-check]')) { return; }
        var block = input.closest('.block');
        var line = block && block.querySelector('.annoudio-status');
        if (!line) { return; }
        var value = input.value.trim();
        if (value === '') { line.textContent = ''; return; }
        fetch(input.getAttribute('data-annoudio-check') + '?recording=' + encodeURIComponent(value), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        }).then(function (response) { return response.json(); }).then(function (answer) {
            if (input.value.trim() !== value) { return; }
            var span = document.createElement('span');
            span.className = answer['class'];
            span.textContent = answer.text;
            line.textContent = '';
            line.appendChild(span);
        })['catch'](function () {});
    }, true);
})();
</script>
HTML;

    public function onHydrate(SitePageBlock $block, ErrorStore $errorStore)
    {
        $data = $block->getData();
        $recording = trim((string) ($data['recording'] ?? ''));
        $src = trim((string) ($data['src'] ?? ''));
        if ($src !== '' && !preg_match('~^https?://\S+$~i', $src)) {
            $src = '';
        }

        if ($recording === '') {
            $errorStore->addError('o:block', 'Annoudio widget: type the recording number.'); // @translate
        }
        $media = null;
        foreach ($block->getAttachments() as $attachment) {
            $media = $attachment->getMedia() ?? $media;
        }
        if ($media !== null && $media->hasOriginal() && !str_starts_with((string) $media->getMediaType(), 'audio/')) {
            $errorStore->addError('o:block', 'Annoudio widget: the attached media is not audio. Attach an audio media, or remove the attachment.'); // @translate
        }
        // A recording that the stack does not know is a sure error. Other failures
        // (stack down, server cannot reach it) do not block the save: the stored copy stays.
        if ($recording !== '' && $this->stack->isConfigured()) {
            try {
                $src = $this->stack->recording($recording)['url'];
            } catch (StackError $e) {
                if ($e->kind === StackError::NOT_FOUND || $e->kind === StackError::BAD_RECORDING) {
                    $errorStore->addError('o:block', 'Annoudio widget: ' . $e->getMessage());
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

    /**
     * One line above the form: the recording title from the stack, or the problem. The
     * element is always there, so that the check of the page editor can fill it.
     */
    private function status(PhpRenderer $view, ?SitePageBlockRepresentation $block): string
    {
        $recording = $block ? (string) $block->dataValue('recording', '') : '';
        [$class, $text] = self::check($this->stack, fn (string $s) => $view->translate($s), $recording)
            ?? ['', ''];
        $inner = $text === '' ? '' : sprintf('<span class="%s">%s</span>', $class, $view->escapeHtml($text));
        return sprintf('<p class="annoudio-status messages">%s</p>', $inner);
    }

    /**
     * The status of a recording number as [class, text]: "Recording found: …", the problem,
     * or "not set up". Null for an empty number. The form and RecordingController use it.
     *
     * @param callable(string): string $translate
     * @return array{0: string, 1: string}|null
     */
    public static function check(Stack $stack, callable $translate, string $recording): ?array
    {
        if (!$stack->isConfigured()) {
            return ['error', $translate('Annoudio is not set up. A global administrator must type the stack address and the project in Modules, Annoudio, Configure.')];
        }
        if ($recording === '') {
            return null;
        }
        try {
            return ['success', sprintf($translate('Recording found: %s'), $stack->recording($recording)['title'])];
        } catch (StackError $e) {
            return ['error', $e->getMessage()];
        }
    }
}
