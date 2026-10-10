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
    // The check of the page editor: /admin/annoudio/recording?recording=1 (RecordingController).
    'controllers' => [
        'factories' => [
            Controller\RecordingController::class => Service\RecordingControllerFactory::class,
        ],
    ],
    'router' => [
        'routes' => [
            'admin' => [
                'child_routes' => [
                    'annoudio-recording' => [
                        'type' => \Laminas\Router\Http\Literal::class,
                        'options' => [
                            'route' => '/annoudio/recording',
                            // The admin route sets its own __NAMESPACE__: name ours, so the
                            // controller resolves to Annoudio\Controller\RecordingController.
                            'defaults' => [
                                '__NAMESPACE__' => 'Annoudio\Controller',
                                'controller' => 'RecordingController',
                                'action' => 'check',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ],
    'view_manager' => [
        'template_path_stack' => [
            dirname(__DIR__) . '/view',
        ],
    ],
];
