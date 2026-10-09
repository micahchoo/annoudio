<?php
namespace Annoudio;

return [
    'service_manager' => [
        'factories' => [
            Stack::class => Service\StackFactory::class,
        ],
    ],
    'block_layouts' => [
        'factories' => [
            'annoudioPlayer' => Service\PlayerFactory::class,
        ],
    ],
    'view_manager' => [
        'template_path_stack' => [
            dirname(__DIR__) . '/view',
        ],
    ],
];
