<?php
namespace Annoudio\Service;

use Annoudio\Site\BlockLayout\Player;
use Annoudio\Stack;
use Interop\Container\ContainerInterface;
use Laminas\ServiceManager\Factory\FactoryInterface;

class PlayerFactory implements FactoryInterface
{
    public function __invoke(ContainerInterface $services, $requestedName, ?array $options = null)
    {
        return new Player($services->get(Stack::class));
    }
}
