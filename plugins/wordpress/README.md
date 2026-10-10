# Annoudio for WordPress

This plugin adds one block to WordPress: **Annoudio widget**. The block shows a recording and the community stories about it. The stories come from your organisation's Annoudio stack.

Use this plugin in place of a pasted snippet. WordPress removes a pasted `<script>` when the author does not have the `unfiltered_html` capability. Authors and editors do not have it. The block keeps no HTML, so WordPress does not remove it.

You need:

- WordPress 6.5 or newer, with PHP 8.2 or newer.
- The file `annoudio.zip`.
- An operator account in the Annoudio admin, or a person who has one.

## What to copy from the Annoudio admin

You copy two values one time, for the settings page. Then you copy one number for each block.

1. Sign in to the Annoudio admin.
2. Open **Catalogue**, **Recordings**. Open the recording.
3. Find the **Snippet** panel. If your organisation has more than one project, select the project in the dropdown.
4. The panel shows the line "Recording number: 1" and the snippet, two lines of code, for example:

   ```html
   <script async src="https://stories.example.org/embed/v1.js"></script>
   <annoudio-player project="river-voices" recording="1" src="https://stories.example.org/media/ferry.m4a"></annoudio-player>
   ```

| Value | Where it is | Where you use it |
|---|---|---|
| Stack address | The start of the first snippet line, before `/embed/v1.js`. Example: `https://stories.example.org` | Settings page, one time |
| Project | `project="…"` in the snippet. Example: `river-voices` | Settings page, one time |
| Recording number | The number after "Recording number:". Example: `1` | Each block |

You do not copy the audio address. The block gets it from the Annoudio admin.

## Install the plugin

1. In the WordPress admin, open **Plugins**, **Add New Plugin**.
2. Click **Upload Plugin** at the top of the page.
3. Click **Choose File**. Select `annoudio.zip`. Click **Install Now**.
4. Click **Activate Plugin**.

You must be an administrator to do these steps.

## Connect the site to the stack

1. Open **Settings**, **Annoudio**.
2. In **Stack address**, type the stack address. Example: `https://stories.example.org`.
3. In **Project**, type the project. Example: `river-voices`.
4. Leave **Server address** empty. (See "Problems" below for the one case that needs it.)
5. Click **Save and check**.

What you see: a box at the top of the page. A green box says "Connected to River Voices (project river-voices) at https://stories.example.org." It shows the project name from the Annoudio admin. A red box says what is wrong, in one sentence.

## Add a widget to a post or a page

Authors, editors and administrators can do these steps.

1. Open the post or the page in the block editor.
2. Click the **+** button (Block Inserter). Type `Annoudio`. Click **Annoudio widget**.
3. What you see: a grey box with an audio icon, the title "Annoudio widget", the field **Recording number** and the field **Or paste the snippet**.
4. In **Recording number**, type the number from the Snippet panel. Example: `1`.
5. After a moment, a green box shows two lines: "Recording found:" and the title of the recording, then "Audio address (from the Annoudio admin):" and the address.
6. Publish or update the post.

The editor shows the grey box, not the widget. To see the widget, open the published post.

You can also paste the full snippet into **Or paste the snippet**. The block reads the recording number from it. It does not keep the pasted text.

### Where the audio address comes from

The Annoudio admin is the source of the audio address. When a visitor opens the post, the block uses the address that the admin has now. So when the operator changes the audio address of a recording in the admin, every post shows the new address within 5 minutes. You do not edit the posts.

The post also keeps a copy of the address, from the last save. The block uses the copy only when this server cannot reach the stack. If the server cannot reach the stack and the post has no copy, the post shows no widget.

## Problems

**The settings page says "This site cannot reach …".** The WordPress server cannot connect to the stack. Visitors can still see widgets: their browsers connect to the stack, not your server. Only the checks fail. If the stack and WordPress run on one computer in Docker, type in **Server address** the address that the WordPress server uses to reach the stack (for example `http://app:3000`). The checks then use that address. Visitors' browsers still use the stack address.

**The settings page says "The stack has no project …".** The project is not correct. Copy the value of `project="…"` from the snippet again.

**The block says "The project … has no recording with the number …".** The recording number is not correct. Copy the number after "Recording number:" in the Snippet panel again.

**The block says "… is not a recording number".** Type only the number, for example `1`, not the text "Recording number:".

**The block says "This snippet is for the project …".** You copied the snippet of a different project. The block always uses the project of the settings page.

**The published post shows no widget.** Make sure that the settings page shows the green box, and that the block shows "Recording found:". Then update the post one time: the update saves the copy of the audio address.

**The block says "has no recording" for every recording number, also for correct ones.** The stack is older than the block. The block needs the recording route of the stack (`/embed/v1/recordings/…`, Annoudio releases from 2026-10-09). Ask the Annoudio operator to update the stack.

## What the block prints

For each block, the page gets the snippet of the Annoudio contract:

```html
<script async src="https://stories.example.org/embed/v1.js"></script>
<div class="wp-block-annoudio-player"><annoudio-player project="river-voices" recording="1" src="https://stories.example.org/media/ferry.m4a"></annoudio-player></div>
```

The `<script>` line comes one time per page, also when the page has many widgets. The widget gets its colours and fonts from the project's theme in the Annoudio admin. The plugin adds no styles.

## Remove the plugin

Open **Plugins**. Click **Deactivate** under Annoudio, then **Delete**. WordPress also deletes the settings. Posts keep the block. They show no widget until you install the plugin again.
