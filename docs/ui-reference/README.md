# UI reference

What the app should feel like: Godot's own editor, stock 4.7 dark theme. The agent compares its Playwright screenshots against these before marking a UI item done (see `docs/done-criteria.md`, Look section).

## Tyler's screenshots (authoritative, Godot 4.7 on his PC)

Drop them in this folder with these names when taken:

- `create-new-node.png` — the Create New Node dialog (Scene dock → + → search, tree with icons, description at the bottom).
- `script-editor.png` — a script open in the script editor (JetBrains Mono, syntax colours).
- `help-panel.png` — the editor help for one class (Search Help → e.g. Timer).

## From the Godot docs (`from-godot-docs/`)

Downloaded 2026-10-13 from `godotengine/godot-docs`, branch `4.7`, under CC BY 3.0, attributed to "Juan Linietsky, Ariel Manzur and the Godot community". These are the docs' own editor screenshots; some were taken on earlier 4.x editors, so Tyler's screenshots win where they differ.

- **Create New Node dialog:** `nodes_and_scenes_03_create_node_window.webp` (the best one: search field, tree with class icons, "Class Node < Object" description panel), `nodes_and_scenes_04_create_label_window.webp`, `add_node.webp`, `key_concepts_node_menu.webp`.
- **Class help panel:** `editor_intro_help_class_animated_sprite.webp` (stock dark theme: "Class:" + icon + name, "Inherits:" chain with icons, bold brief description, accent-blue "Description" heading, inline code in monospace). Also `editor_intro_search_help.webp` for the Search Help dialog.
- **Script editor, stock dark theme:** `editor_intro_workspace_script.webp` (keywords in the pink-red, types in green, functions in blue, strings in yellow, comments grey, on the dark script background). **Caution:** `editor_ui_script_editor_coding_area.webp` was taken on the LIGHT editor theme; use it for layout only, never for colours.
- **Signals list:** `player_signals.webp` (the Node dock).
- The `scripting_first_script_*.webp` files show small editor fragments (attach-script dialog, scene tree); minor.

The rule in `CLAUDE.md` still holds: colours, fonts, icons, wording and control styles come from Godot; the layout does not. These images show the parts, not a layout to copy.
