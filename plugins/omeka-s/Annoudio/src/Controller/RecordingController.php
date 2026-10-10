<?php
namespace Annoudio\Controller;

use Annoudio\Site\BlockLayout\Player;
use Annoudio\Stack;
use Laminas\Mvc\Controller\AbstractActionController;

/**
 * GET /admin/annoudio/recording?recording=1: the status line of the block for a recording
 * number, as JSON ({"class": "success", "text": "Recording found: …"}). The page editor
 * asks it when the number field loses focus, so the block says "Recording found" before
 * a save, as the WordPress block does. Signed-in users that can edit pages only (Module).
 */
class RecordingController extends AbstractActionController
{
    public function __construct(private readonly Stack $stack)
    {
    }

    public function checkAction()
    {
        $recording = trim((string) $this->params()->fromQuery('recording', ''));
        [$class, $text] = Player::check($this->stack, fn (string $s) => $this->translate($s), $recording)
            ?? ['', ''];
        $response = $this->getResponse();
        $response->getHeaders()
            ->addHeaderLine('Content-Type', 'application/json')
            ->addHeaderLine('Cache-Control', 'no-store');
        $response->setContent(json_encode(['class' => $class, 'text' => $text]));
        return $response;
    }
}
