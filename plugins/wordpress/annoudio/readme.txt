=== Annoudio ===
Contributors: annoudio
Tags: audio, oral history, stories, annotation, block
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 8.2
Stable tag: 0.3.0
License: MIT
License URI: https://opensource.org/licenses/MIT

The "Annoudio widget" block. It shows a recording and its community stories from your Annoudio stack.

== Description ==

Annoudio is an audio widget with community stories. Your organisation runs one Annoudio stack. This plugin adds one block, "Annoudio widget", to the block editor.

The block keeps only the recording number (a number) and a copy of the audio address. It keeps no HTML. So authors and editors without the "unfiltered_html" capability can add widgets. WordPress does not remove them.

The block gets the title and the audio address of the recording from the Annoudio admin. A page view uses the address that the admin has now (this server keeps it for 5 minutes). The copy in the post is used only when this server cannot reach the stack.

The block needs a stack that has the recording route (/embed/v1/recordings/…, Annoudio releases from 2026-10-09).

The plugin has one settings page: Settings, Annoudio. Type the stack address and the project there. The page tells you if the site can connect.

== Installation ==

1. In the WordPress admin, open Plugins, Add New Plugin.
2. Click Upload Plugin. Select annoudio.zip. Click Install Now.
3. Click Activate.
4. Open Settings, Annoudio. Type the stack address and the project. Click Save and check.
5. Make sure that the page says "Connected to …" and the project name.

== Frequently Asked Questions ==

= What do I copy from the Annoudio admin? =

One number. Open the recording in the Annoudio admin. Its Snippet panel shows "Recording number: 1". Type that number in the block's "Recording number" field. You can also paste the full snippet into "Or paste the snippet".

= The settings page says "This site cannot reach …" =

The WordPress server cannot connect to the stack address. If WordPress and the stack run in Docker on one computer, type the address that the WordPress server can use in "Server address". Visitors' browsers still use the stack address.

== Changelog ==

= 0.3.0 =
* One name with the Annoudio admin: the block is "Annoudio widget", and its field is "Recording number". The inserter also finds it with "widget", "audio" and "story". Posts keep their blocks (the block name annoudio/player does not change).

= 0.2.0 =
* The block needs only the recording number. It gets the title and the audio address from the Annoudio admin, at page view, with a 5-minute cache.
* The settings page shows the project name.

= 0.1.0 =
* First release: the "Annoudio player" block and the settings page.
