<?php
/**
 * Pastes the Annoudio snippet into one Omeka S page HTML block, through the Omeka API manager.
 * The API manager runs the same block hydration as the admin form (with HTMLPurifier when it is on).
 * Test hosts only.
 *
 * Use (inside the omeka container, in /var/www/html):
 *   php /opt/annoudio/omeka-page.php <page-slug> <purifier: on|off> < snippet.html
 * Prints the public page URL path.
 */

if (PHP_SAPI !== 'cli') {
    exit(1);
}
[$script, $slug, $purifier] = $argv + [null, null, null];
if (!$slug || !in_array($purifier, ['on', 'off'], true)) {
    fwrite(STDERR, "Use: php omeka-page.php <page-slug> <on|off> < snippet.html\n");
    exit(1);
}
$html = stream_get_contents(STDIN);

chdir('/var/www/html');
require 'bootstrap.php';
$app = \Laminas\Mvc\Application::init(require 'application/config/application.config.php');
$services = $app->getServiceManager();

// Act as the first administrator, as an operator in the admin would.
$em = $services->get('Omeka\EntityManager');
$admin = $em->getRepository(\Omeka\Entity\User::class)->findOneBy(['role' => 'global_admin']);
$services->get('Omeka\AuthenticationService')->getStorage()->write($admin);

$services->get('Omeka\Settings')->set('use_htmlpurifier', $purifier === 'on');

$api = $services->get('Omeka\ApiManager');
$sites = $api->search('sites', ['slug' => 'annoudio'])->getContent();
if ($sites) {
    $site = $sites[0];
} else {
    $site = $api->create('sites', [
        'o:title' => 'Annoudio test site',
        'o:slug' => 'annoudio',
        'o:theme' => 'default',
        'o:is_public' => true,
        'o:navigation' => [],
        'o:item_pool' => [],
    ])->getContent();
}

$block = ['o:layout' => 'html', 'o:data' => ['html' => $html, 'divclass' => '']];
$pages = $api->search('site_pages', ['site_id' => $site->id(), 'slug' => $slug])->getContent();
if ($pages) {
    $api->update('site_pages', $pages[0]->id(), [
        'o:title' => 'Ferry crossing, 1962',
        'o:slug' => $slug,
        'o:is_public' => true,
        'o:block' => [$block],
    ], [], ['isPartial' => false]);
} else {
    $api->create('site_pages', [
        'o:site' => ['o:id' => $site->id()],
        'o:title' => 'Ferry crossing, 1962',
        'o:slug' => $slug,
        'o:is_public' => true,
        'o:block' => [$block],
    ]);
}
echo "/s/annoudio/page/{$slug}\n";
