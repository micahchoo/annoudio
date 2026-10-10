<?php
namespace Annoudio\Service;

use Annoudio\Controller\RecordingController;
use Annoudio\Stack;
use Interop\Container\ContainerInterface;
use Laminas\ServiceManager\Factory\FactoryInterface;

class RecordingControllerFactory implements FactoryInterface
{
    public function __invoke(ContainerInterface $services, $requestedName, ?array $options = null)
    {
        return new RecordingController($services->get(Stack::class));
    }
}
