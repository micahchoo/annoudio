<?php
namespace Annoudio\Service;

use Annoudio\FileCache;
use Annoudio\Stack;
use Interop\Container\ContainerInterface;
use Laminas\ServiceManager\Factory\FactoryInterface;

/** Makes the Stack from the module settings. */
class StackFactory implements FactoryInterface
{
    public function __invoke(ContainerInterface $services, $requestedName, ?array $options = null)
    {
        $settings = $services->get('Omeka\Settings');
        return new Stack(
            (string) $settings->get(Stack::SETTING_ORIGIN, ''),
            (string) $settings->get(Stack::SETTING_PROJECT, ''),
            (string) $settings->get(Stack::SETTING_SERVER_ORIGIN, ''),
            // Omeka\HttpClient is not shared: each get() gives a new client.
            fn () => $services->get('Omeka\HttpClient'),
            FileCache::fromConfig($services->get('Config')),
        );
    }
}
