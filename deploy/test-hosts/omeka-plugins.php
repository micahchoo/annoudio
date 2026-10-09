<?php
/**
 * Installs the Annoudio module in the test Omeka S and makes the two test pages.
 * Test hosts only. install-plugins.sh copies this file into the container and runs it.
 *
 * Use (inside the omeka container):
 *   php omeka-plugins.php <origin> <project> <server-origin> <recording> <ingest-url> <stored-url>
 *
 * <ingest-url>: where this container fetches the audio for the Omeka media.
 * <stored-url>: an audio address that plays but is not the admin's. The fallback page
 *               stores it, as a block saved before the admin's address changed.
 *
 * Makes, in the site "annoudio", with the HTML purifier ON:
 *   /s/annoudio/page/annoudio-media     a block with an attached Omeka media (src = its original
 *                                       file), then a block with only the recording ID
 *   /s/annoudio/page/annoudio-fallback  a block with the recording ID and <stored-url> as the
 *                                       stored copy (src = the admin's address while the stack
 *                                       answers, <stored-url> when it does not)
 * Removes the 7a page annoudio-url and empties the module's recording cache.
 */

if (PHP_SAPI !== 'cli') {
    exit(1);
}
[, $origin, $project, $serverOrigin, $recording, $ingest, $stored] = $argv + array_fill(0, 7, null);
if (!$origin || !$project || $serverOrigin === null || !$recording || !$ingest || !$stored) {
    fwrite(STDERR, "Use: php omeka-plugins.php <origin> <project> <server-origin> <recording> <ingest-url> <stored-url>\n");
    exit(1);
}

chdir('/var/www/html');
require 'bootstrap.php';
$app = \Laminas\Mvc\Application::init(require 'application/config/application.config.php');
$services = $app->getServiceManager();
// In a bare init, Settings caches itself before the module manager marks Omeka as
// installed, so Settings::get() reads nothing (AbstractSettings::cache()). Make the module
// manager first, then empty the cache so that the next get() reads the table.
$services->get('Omeka\ModuleManager');
(fn () => $this->cache = null)->call($services->get('Omeka\Settings'));

$em = $services->get('Omeka\EntityManager');
$admin = $em->getRepository(\Omeka\Entity\User::class)->findOneBy(['role' => 'global_admin']);
$services->get('Omeka\AuthenticationService')->getStorage()->write($admin);

// 1 The module: install, upgrade or activate, as the Modules page does.
$modules = $services->get('Omeka\ModuleManager');
$module = $modules->getModule('Annoudio');
if (!$module) {
    fwrite(STDERR, "The module folder modules/Annoudio is missing.\n");
    exit(1);
}
switch ($module->getState()) {
    case \Omeka\Module\Manager::STATE_NOT_INSTALLED:
        $modules->install($module);
        break;
    case \Omeka\Module\Manager::STATE_NEEDS_UPGRADE:
        $modules->upgrade($module);
        break;
    case \Omeka\Module\Manager::STATE_NOT_ACTIVE:
        $modules->activate($module);
        break;
    case \Omeka\Module\Manager::STATE_ACTIVE:
        break;
    default:
        fwrite(STDERR, 'Module state: ' . $module->getState() . "\n");
        exit(1);
}
echo 'Module: ' . $modules->getModule('Annoudio')->getState() . "\n";

// 2 The settings. The purifier stays ON: the block must not need it off.
$settings = $services->get('Omeka\Settings');
$settings->set('annoudio_origin', $origin);
$settings->set('annoudio_project', $project);
$settings->set('annoudio_server_origin', $serverOrigin);
$settings->set('use_htmlpurifier', true);
// The test image installs Omeka S without the default file allowlists, so it refuses every
// upload. A web install sets these defaults (AddDefaultSettingsTask); set them the same way.
if (!$settings->get('media_type_whitelist')) {
    $settings->set('media_type_whitelist', \Omeka\Form\SettingForm::MEDIA_TYPE_WHITELIST);
}
if (!$settings->get('extension_whitelist')) {
    $settings->set('extension_whitelist', \Omeka\Form\SettingForm::EXTENSION_WHITELIST);
}

// Start again with the new settings. Note: a bare init does not load the modules, so
// the module's classes (Stack, the block layout) are not there in this script.
$app = \Laminas\Mvc\Application::init(require 'application/config/application.config.php');
$services = $app->getServiceManager();
// In a bare init, Settings caches itself before the module manager marks Omeka as
// installed, so Settings::get() reads nothing (AbstractSettings::cache()). Make the module
// manager first, then empty the cache so that the next get() reads the table.
$services->get('Omeka\ModuleManager');
(fn () => $this->cache = null)->call($services->get('Omeka\Settings'));
$services->get('Omeka\AuthenticationService')->getStorage()->write(
    $services->get('Omeka\EntityManager')->getRepository(\Omeka\Entity\User::class)->findOneBy(['role' => 'global_admin'])
);
$api = $services->get('Omeka\ApiManager');
// A cached answer from before this run (a stack that was down) must not hide the new one.
// This bare init does not load the modules (see above), so the class is loaded by path.
require_once 'modules/Annoudio/src/FileCache.php';
\Annoudio\FileCache::fromConfig($services->get('Config'))->clear();

// 3 The site.
$sites = $api->search('sites', ['slug' => 'annoudio'])->getContent();
$site = $sites ? $sites[0] : $api->create('sites', [
    'o:title' => 'Annoudio test site',
    'o:slug' => 'annoudio',
    'o:theme' => 'default',
    'o:is_public' => true,
    'o:navigation' => [],
    'o:item_pool' => [],
])->getContent();

// 4 One item in the site, with the audio as an Omeka media (url ingester).
//   The page editor's item picker lists only the items of the site.
$title = 'Ferry crossing, 1962 (Annoudio test)';
$items = $api->search('items', ['property' => [[
    'property' => 'dcterms:title', 'type' => 'eq', 'text' => $title,
]]])->getContent();
if ($items) {
    $item = $items[0];
    if (!array_key_exists($site->id(), $item->sites())) {
        $item = $api->update('items', $item->id(), ['o:site' => [['o:id' => $site->id()]]], [], ['isPartial' => true])->getContent();
    }
} else {
    $item = $api->create('items', [
        'dcterms:title' => [['type' => 'literal', 'property_id' => 1, '@value' => $title]],
        'o:is_public' => true,
        'o:site' => [['o:id' => $site->id()]],
        'o:media' => [['o:ingester' => 'url', 'ingest_url' => $ingest, 'o:is_public' => true]],
    ])->getContent();
}
$media = $item->media()[0] ?? null;
if (!$media) {
    fwrite(STDERR, "The item has no media.\n");
    exit(1);
}
echo 'Media: o:id ' . $media->id() . ', ' . $media->originalUrl() . "\n";

// 5 The two pages. This bare init does not load the modules, so the API save does not run
//   the block's onHydrate: the blocks keep exactly this data (no stored copy).
$mediaBlock = [
    'o:layout' => 'annoudioPlayer',
    'o:data' => ['recording' => $recording],
    'o:attachment' => [['o:item' => ['o:id' => $item->id()], 'o:media' => ['o:id' => $media->id()], 'o:caption' => '']],
];
$idBlock = ['o:layout' => 'annoudioPlayer', 'o:data' => ['recording' => $recording]];
// annoudio-media has two blocks: the page must still load the loader once.
$pages = ['annoudio-media' => [$mediaBlock, $idBlock], 'annoudio-fallback' => [$idBlock]];
foreach ($api->search('site_pages', ['site_id' => $site->id(), 'slug' => 'annoudio-url'])->getContent() as $old) {
    $api->delete('site_pages', $old->id());
}
foreach ($pages as $slug => $blocks) {
    $data = [
        'o:title' => 'Ferry crossing, 1962',
        'o:slug' => $slug,
        'o:is_public' => true,
        'o:block' => $blocks,
    ];
    $found = $api->search('site_pages', ['site_id' => $site->id(), 'slug' => $slug])->getContent();
    if ($found) {
        $api->update('site_pages', $found[0]->id(), $data, [], ['isPartial' => false]);
    } else {
        $api->create('site_pages', $data + ['o:site' => ['o:id' => $site->id()]]);
    }
    echo "Page: /s/annoudio/page/{$slug}\n";
}

// 6 The fallback page's stored copy: written past onHydrate, as if the admin's address
//   changed after the save.
$em = $services->get('Omeka\EntityManager');
$fallback = $api->search('site_pages', ['site_id' => $site->id(), 'slug' => 'annoudio-fallback'])->getContent()[0];
foreach ($em->find(\Omeka\Entity\SitePage::class, $fallback->id())->getBlocks() as $block) {
    $block->setData(['recording' => $recording, 'src' => $stored]);
}
$em->flush();
echo "Stored copy on annoudio-fallback: {$stored}\n";
