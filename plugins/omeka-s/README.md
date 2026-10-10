# Annoudio for Omeka S

This module adds one page block to Omeka S: **Annoudio widget**. The block shows a recording and the community stories about it. The stories come from your organisation's Annoudio stack.

Use this module in place of a pasted snippet. When the HTML purifier is on (the default), Omeka S removes a pasted `<script>` and `<annoudio-player>` from an HTML block. This block keeps no HTML, so the purifier does not remove it. Keep the purifier on.

The audio can be an Omeka media. Attach the media to the block, and the block uses the address of its original file.

You need:

- Omeka S 4.0 or newer, with PHP 8.2 or newer.
- The file `Annoudio-omeka-s.zip`.
- Access to the server folder of Omeka S (to copy the module), and a global administrator account.
- An operator account in the Annoudio admin, or a person who has one.

## What to copy from the Annoudio admin

You copy two values one time, for the module configuration. Then you copy one number for each block.

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
| Stack address | The start of the first snippet line, before `/embed/v1.js`. Example: `https://stories.example.org` | Module configuration, one time |
| Project | `project="…"` in the snippet. Example: `river-voices` | Module configuration, one time |
| Recording number | The number after "Recording number:". Example: `1` | Each block |

You do not copy the audio address. The block gets it from the Annoudio admin, or from an Omeka media that you attach.

**Important:** the recording in Annoudio and the file that the block plays must be the same audio. If the Omeka file is a different edit (for example, cut at the start), the stories show at the wrong times.

## Install the module

1. Unzip `Annoudio-omeka-s.zip`. You get a folder named `Annoudio`. Do not rename it.
2. Copy the folder `Annoudio` into the `modules` folder of your Omeka S installation. Use your file manager or SFTP program. The result is `modules/Annoudio/Module.php`.
3. Sign in to the Omeka S admin as a global administrator.
4. Open **Modules** in the left menu. Find **Annoudio**. Click **Install**.

## Connect Omeka S to the stack

1. On the **Modules** page, click **Configure** next to Annoudio.
2. In **Stack address**, type the stack address. Example: `https://stories.example.org`.
3. In **Project**, type the project. Example: `river-voices`.
4. Leave **Server address** empty. (See "Problems" below for the one case that needs it.)
5. Click **Submit**.
6. Click **Configure** again to see the result.

What you see: a line at the top of the form. A green line says "Connected to River Voices (project river-voices) at https://stories.example.org." It shows the project name from the Annoudio admin. A red line says what is wrong, in one sentence.

## Add a widget to a site page

1. Open **Sites**, select the site, open **Pages**, and open the page. Click **Edit** (the pencil).
2. In the right sidebar, **Add new block**, click **Annoudio widget**.
3. What you see: a block with the field **Recording number**, and a part **Omeka media (optional)** with the button **Add attachment**.
4. In **Recording number**, type the number from the Snippet panel. Example: `1`.
5. Optional: if the audio is also an Omeka media, and it is the same file, click **Add attachment**. Select the item. Select the media. Click **Apply changes**.
6. Click **Save**.

After the save, the block shows a green line: "Recording found:" and the title of the recording. If the recording number is not correct, Omeka S does not save the page and shows the problem at the top.

To see the widget, open the public page. The page editor shows the fields, not the widget.

### Where the audio address comes from

The block uses the first of these that it has:

1. The original file of the attached Omeka media.
2. The audio address that the Annoudio admin has now. When the operator changes the address in the admin, every page shows the new address within 5 minutes. You do not edit the pages.
3. A copy of the admin's address, which the block keeps from the last save. The block uses it only when this server cannot reach the stack.

If none is there, the page shows no widget for that block.

## Problems

**The configuration says "This server cannot reach …".** The Omeka S server cannot connect to the stack. Visitors can still see widgets: their browsers connect to the stack, not your server. Only the checks fail. If the stack and Omeka S run on one computer in Docker, type in **Server address** the address that the Omeka S server uses to reach the stack (for example `http://app:3000`). Visitors' browsers still use the stack address.

**The configuration says "The stack has no project …".** The project is not correct. Copy the value of `project="…"` from the snippet again.

**The page does not save: "Annoudio widget: The project … has no recording with the number …".** The recording number is not correct. Copy the number after "Recording number:" in the Snippet panel again. If this happens for every recording number, also for correct ones, the stack is older than the module: the module needs the recording route of the stack (`/embed/v1/recordings/…`, Annoudio releases from 2026-10-09). Ask the Annoudio operator to update the stack.

**The page does not save: "… is not a recording number".** Type only the number, for example `1`, not the text "Recording number:".

**Omeka S refuses the audio file when you add the media.** Open **Settings**, **Security**. Make sure that **Allowed media types** has `audio/mp4` (or `audio/mpeg` for MP3) and that **Allowed file extensions** has `m4a` (or `mp3`).

**The public page shows no widget.** Make sure that the configuration shows the green line, and that the block shows "Recording found:". Then save the page one time: the save keeps the copy of the audio address.

## What the block prints

The page gets the snippet of the Annoudio contract. Omeka S puts the `<script>` line in the page head, one time per page, also when the page has many widgets:

```html
<script async="async" src="https://stories.example.org/embed/v1.js"></script>
…
<div class="block block-annoudioPlayer"><annoudio-player project="river-voices" recording="1" src="https://omeka.example.org/files/original/3f2a….m4a"></annoudio-player></div>
```

The widget gets its colours and fonts from the project's theme in the Annoudio admin. The module adds no styles.

## Remove the module

Open **Modules**. Click **Deactivate**, then **Uninstall**. Omeka S deletes the module settings. Pages keep the blocks, but Omeka S does not show them while the module is not active. Then delete the folder `modules/Annoudio`.
