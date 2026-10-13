# UI reference

What the app should feel like: Godot's own editor, stock 4.7 dark theme. The agent compares its Playwright screenshots against these before marking a UI item done (see `docs/done-criteria.md`, Look section).

## The reference set: Godot's own docs screenshots (`from-godot-docs/`)

Downloaded 2026-10-13 from `godotengine/godot-docs`, branch `4.7`, under CC BY 3.0, attributed to "Juan Linietsky, Ariel Manzur and the Godot community". They cover all three surfaces the app borrows from; use them as the reference. (Optional: a screenshot from Tyler's own 4.7 editor can be dropped here as `create-new-node.png`, `script-editor.png` or `help-panel.png` if one of the docs images ever turns out to be from an older editor; none is required.)

- **Create New Node dialog:** `nodes_and_scenes_03_create_node_window.webp` (the best one: search field, tree with class icons, "Class Node < Object" description panel), `nodes_and_scenes_04_create_label_window.webp`, `add_node.webp`, `key_concepts_node_menu.webp`.
- **Class help panel:** `editor_intro_help_class_animated_sprite.webp` (stock dark theme: "Class:" + icon + name, "Inherits:" chain with icons, bold brief description, accent-blue "Description" heading, inline code in monospace). Also `editor_intro_search_help.webp` for the Search Help dialog.
- **Script editor, stock dark theme:** `editor_intro_workspace_script.webp` (keywords in the pink-red, types in green, functions in blue, strings in yellow, comments grey, on the dark script background). **Caution:** `editor_ui_script_editor_coding_area.webp` was taken on the LIGHT editor theme; use it for layout only, never for colours.
- **Signals list:** `player_signals.webp` (the Node dock).
- The `scripting_first_script_*.webp` files show small editor fragments (attach-script dialog, scene tree); minor.

The rule in `CLAUDE.md` still holds: colours, fonts, icons, wording and control styles come from Godot; the layout does not. These images show the parts, not a layout to copy.
