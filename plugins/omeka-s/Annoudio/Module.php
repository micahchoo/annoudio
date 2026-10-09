<?php
namespace Annoudio;

use Laminas\Form\Element;
use Laminas\Form\Form;
use Laminas\Mvc\Controller\AbstractController;
use Laminas\View\Renderer\PhpRenderer;
use Omeka\Module\AbstractModule;

/**
 * The Annoudio module: one setting (stack address and project) and one page block.
 */
class Module extends AbstractModule
{
    public function getConfig()
    {
        return include __DIR__ . '/config/module.config.php';
    }

    /** Modules, Annoudio, Configure. The status line shows the live check. */
    public function getConfigForm(PhpRenderer $renderer)
    {
        $stack = $this->getServiceLocator()->get(Stack::class);
        $form = new Form('annoudio-config');
        $form->add([
            'type' => Element\Url::class,
            'name' => Stack::SETTING_ORIGIN,
            'options' => [
                'label' => 'Stack address', // @translate
                'info' => 'The start of the address in the snippet, before /embed/v1.js. Visitors\' browsers use this address. Example: https://stories.example.org', // @translate
            ],
            'attributes' => ['value' => $stack->origin, 'id' => 'annoudio-origin', 'required' => true],
        ]);
        $form->add([
            'type' => Element\Text::class,
            'name' => Stack::SETTING_PROJECT,
            'options' => [
                'label' => 'Project', // @translate
                'info' => 'The project slug: the value of project="…" in the snippet.', // @translate
            ],
            'attributes' => ['value' => $stack->project, 'id' => 'annoudio-project', 'required' => true],
        ]);
        $form->add([
            'type' => Element\Url::class,
            'name' => Stack::SETTING_SERVER_ORIGIN,
            'options' => [
                'label' => 'Server address (optional)', // @translate
                'info' => 'Leave this empty in most cases. Set it only when this server must use a different address to reach the stack, for example when both run in Docker on one computer. Only the checks use it.', // @translate
            ],
            'attributes' => ['value' => $stack->serverOrigin, 'id' => 'annoudio-server-origin'],
        ]);
        return $this->status($renderer, $stack) . $renderer->formCollection($form, false);
    }

    public function handleConfigForm(AbstractController $controller)
    {
        $post = $controller->getRequest()->getPost();
        $settings = $this->getServiceLocator()->get('Omeka\Settings');
        $values = [Stack::SETTING_PROJECT => trim((string) ($post[Stack::SETTING_PROJECT] ?? ''))];
        try {
            foreach ([Stack::SETTING_ORIGIN, Stack::SETTING_SERVER_ORIGIN] as $key) {
                $value = trim((string) ($post[$key] ?? ''));
                $values[$key] = $value === '' ? '' : Stack::normalizeOrigin($value);
            }
        } catch (StackError $e) {
            $controller->messenger()->addError($e->getMessage());
            return false;
        }
        foreach ($values as $key => $value) {
            $settings->set($key, $value);
        }
        return true;
    }

    public function uninstall(\Laminas\ServiceManager\ServiceLocatorInterface $services)
    {
        $settings = $services->get('Omeka\Settings');
        foreach ([Stack::SETTING_ORIGIN, Stack::SETTING_PROJECT, Stack::SETTING_SERVER_ORIGIN] as $key) {
            $settings->delete($key);
        }
        FileCache::fromConfig($services->get('Config'))->clear();
    }

    /** "Connected to River Voices (project river-voices) at …" or the problem. */
    private function status(PhpRenderer $view, Stack $stack): string
    {
        if (!$stack->isConfigured()) {
            [$class, $text] = ['warning', $view->translate('Not set up. Type the stack address and the project, then submit.')];
        } else {
            try {
                $name = $stack->checkProject();
                $text = $name !== ''
                    ? sprintf($view->translate('Connected to %1$s (project %2$s) at %3$s.'), $name, $stack->project, $stack->origin)
                    : sprintf($view->translate('Connected to project %1$s at %2$s.'), $stack->project, $stack->origin);
                $class = 'success';
            } catch (StackError $e) {
                [$class, $text] = ['error', $e->getMessage()];
            }
        }
        return sprintf('<ul class="messages" id="annoudio-status"><li class="%s">%s</li></ul>', $class, $view->escapeHtml($text));
    }
}
