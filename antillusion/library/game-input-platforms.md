# Game input across platforms: gamepads, glyphs, deadzones, rumble, touch, keyboard+mouse, rebinding
tags: gamepad controller input xbox playstation dualshock dualsense switch joycon pro controller steam deck steam input xinput directinput sdl gamecontrollerdb glyphs prompts deadzone rumble haptics adaptive triggers gyro touch keyboard mouse rebinding remap accessibility godot unity unreal enhanced input لعبه العاب تحكم يد جهاز ذراع ازرار اهتزاز لمس كيبورد ماوس منصات اعاده تعيين وصول

For browser/Electron games use the `game-input` template (use_template("game-input")): one action map for keyboard, mouse, every gamepad and touch, with glyphs, rumble and rebinding. The rest of this card is the knowledge behind it and the engine equivalents.

## Core rules
- Code against **actions** (`jump`, `move`, `confirm`, `pause`), never raw buttons. Bindings live in data, per device family.
- Read input once per frame into an input state; gameplay reads the state. Edge-detect `pressed` / `released` yourself from the previous frame.
- Every action must be reachable by every supported device. Menus must be fully navigable by gamepad alone (and by keyboard alone).
- Show prompts (glyphs) for the **last device that produced input**, switching instantly but debounced (ignore stick noise below 0.3 and mouse moves under ~4 px).

## W3C Gamepad API "standard" mapping (`gamepad.mapping === "standard"`)
Indices are **positional** (bottom face button is always 0), labels differ per vendor.
| Index | Position | Xbox | PlayStation | Switch |
|---|---|---|---|---|
| 0 | face bottom | A | Cross ✕ | B |
| 1 | face right | B | Circle ○ | A |
| 2 | face left | X | Square □ | Y |
| 3 | face top | Y | Triangle △ | X |
| 4 | left shoulder | LB | L1 | L |
| 5 | right shoulder | RB | R1 | R |
| 6 | left trigger (analog `.value` 0–1) | LT | L2 | ZL (digital on Switch: 0 or 1) |
| 7 | right trigger (analog) | RT | R2 | ZR (digital) |
| 8 | select / back | View | Share (DS4) / Create (DualSense) | − Minus |
| 9 | start | Menu | Options | + Plus |
| 10 | left stick click | LS | L3 | LS click |
| 11 | right stick click | RS | R3 | RS click |
| 12 | d-pad up | ↑ | ↑ | ↑ |
| 13 | d-pad down | ↓ | ↓ | ↓ |
| 14 | d-pad left | ← | ← | ← |
| 15 | d-pad right | → | → | → |
| 16 | home / guide | Xbox button | PS button | Home |
| 17+ | non-standard extras | Share (Series) | touchpad click | Capture |

| Axis | Meaning | Range |
|---|---|---|
| 0 | left stick X | −1 left … +1 right |
| 1 | left stick Y | −1 **up** … +1 down (invert for "up = positive") |
| 2 | right stick X | −1 … +1 |
| 3 | right stick Y | −1 up … +1 down |

Gotchas:
- `navigator.getGamepads()` must be called **every frame** (Chromium returns snapshots). Pads only appear after the user presses a button (fingerprinting protection); show "Press any button".
- If `mapping !== "standard"` the layout is unknown: offer a mapping wizard or fall back to a DB keyed by vendor/product id. Guide/Home is often swallowed by the OS or Steam.
- Index 17+ and touchpads are browser/OS dependent — never require them.

## Detecting the controller family
`gamepad.id` contains vendor/product ids (Chromium: `"... (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)"`; Firefox: `"054c-0ce6-DualSense Wireless Controller"`). XInput pads on Windows Chromium often show `"Xbox 360 Controller (XInput STANDARD GAMEPAD)"` with no ids — treat "xinput" as Xbox.
| Vendor id | Family | Well-known product ids |
|---|---|---|
| `045e` | Microsoft Xbox | 028e (360), 02ea/02e0/02fd (One / One S), 0b12/0b13 (Series X\|S) |
| `054c` | Sony PlayStation | 05c4/09cc (DualShock 4), 0ce6 (DualSense), 0df2 (DualSense Edge) |
| `057e` | Nintendo | 2009 (Switch Pro), 2006/2007 (Joy-Con L/R) |
| `28de` | Valve | Steam Deck built-in controls, Steam Controller, Steam Input virtual pads |
Regex order: sony `/054c|dualsense|dualshock|playstation/i`, nintendo `/057e|switch|joy-con|pro controller/i`, valve `/28de|steam/i`, then default to Xbox glyphs (most generic pads are XInput clones). Let the player override the glyph set in settings.

## Nintendo position swap and the confirm button
- Xbox/PS: bottom = confirm, right = back. Nintendo: **right (A) = confirm, bottom (B) = back**. Japan-region PS4 used Circle = confirm; PS5 uses Cross = confirm in all regions.
- On a native Switch build, confirm must be A (right). On PC with a Switch pad, default to positional (bottom = confirm) **but label it with the Nintendo letter that is printed there** (B), and offer "Nintendo button layout" to swap confirm/back. Never show an Xbox "A" glyph on a Nintendo pad — that's the classic wrong-button bug.
- Bind `confirm`/`cancel` as UI actions separate from gameplay actions so the swap only affects menus if the player chooses.

## Glyph conventions
| Family | Face glyphs | Colours | Other names |
|---|---|---|---|
| Xbox | A B X Y letters | A green, B red, X blue, Y yellow | LB/RB, LT/RT, View, Menu |
| PlayStation | ✕ ○ □ △ shapes (never letters) | classic: ✕ blue, ○ red, □ pink, △ green; PS5 UI uses monochrome | L1/R1, L2/R2, Create/Share, Options, touchpad |
| Switch | A B X Y letters, **monochrome** | none | L/R, ZL/ZR, +/−, Home, Capture |
| Steam Deck | A B X Y (Xbox positions), monochrome | none | L4/L5/R4/R5 back grips, trackpads, "..." and Steam buttons |
| Keyboard | key caps with the **layout-local label** | — | mouse LMB/RMB/wheel icons |
Rules: one glyph atlas per family, same grid size (e.g. 64 px) so prompts don't reflow; prompts in text use tokens (`"Press {jump} to jump"`) replaced at render; refresh all prompts on device change.

## Sticks: deadzones and response curves
| Technique | Recipe | Use |
|---|---|---|
| Axial (per-axis) | `x = abs(x) < dz ? 0 : x` | d-pad-like menus only; snaps to axes, feels square |
| Radial | `m = hypot(x,y); if (m < dz) zero` | default for movement |
| Scaled radial | `s = clamp((m - inner)/(outer - inner), 0, 1); v = (x,y)/m * s` | best: smooth from 0 at the edge of the deadzone |
| Outer deadzone | outer 0.90–0.95 | lets worn sticks still reach full speed |
Numbers: inner 0.15–0.25 for movement (0.10 for fresh pads, worn Joy-Cons need 0.25+), 0.10–0.15 for aim with a curve. Response curve for aiming: `s' = s^k`, k = 1.5–2.5 (fine control near centre); keep movement linear. Expose deadzone and sensitivity sliders. Stick-as-menu-input: threshold 0.5, repeat after 400 ms then every 80–120 ms.

## Triggers
Analog 0–1 (except Switch ZL/ZR, digital). As a button use hysteresis: press at > 0.35, release at < 0.25. For throttle/brake use the full range with a small 0.05 deadzone. Don't require full pulls (worn triggers rarely report 1.0; treat ≥ 0.95 as full).

## Rumble and haptics
- Web (Chromium, so Electron too): `pad.vibrationActuator?.playEffect('dual-rumble', { startDelay: 0, duration: 120, weakMagnitude: 0.4, strongMagnitude: 0.8 })`; `reset()` to stop. Some Chromium builds on Windows also accept `'trigger-rumble'` for Xbox impulse triggers. Firefox and Safari support is limited/varies — feature-detect and never make rumble carry required information.
- Recipes: hit 80–150 ms strong 0.6–0.9; footstep/engine 30–60 ms weak 0.1–0.2; explosion 300–500 ms both high, fading (issue several shorter effects). Weak motor = high-frequency (right), strong = low-frequency (left).
- Rumble slider 0–100 % plus off. Stop all rumble on pause, focus loss and disconnect.
- **DualSense adaptive triggers and HD haptics** are not in the Gamepad API. On PS5 they need the PlayStation SDK. On PC: SDL3 can send raw DualSense effect packets, Steamworks exposes a DualSense trigger-effect call through Steam Input, and voice-coil HD haptics generally need a wired USB connection (they're driven like an audio channel). Treat them as optional polish.

## Gyro
Gamepad API has no standard gyro. Options: Steam Input (gyro → mouse/joystick, user-configurable), SDL3 sensors (`SDL_SetGamepadSensorEnabled(pad, SDL_SENSOR_GYRO, true)` then `SDL_GetGamepadSensorData`), WebHID in Chromium (raw HID reports, per-device parsing — advanced), native platform SDKs. Gyro-aim tips: add it on top of stick aim, sensitivity as real-world:in-game ratio (1:1–3:1), "ratchet" button to reposition, optional enable-only-while-aiming, small smoothing (~1 frame) only at tiny velocities.

## Hot-plug and disconnect
- Web: `gamepadconnected` / `gamepaddisconnected` events + re-scan `getGamepads()` each frame (events can be missed while the tab is hidden).
- If the active player's controller disconnects mid-game: **pause immediately**, show "Controller disconnected — reconnect or press any button on another controller", keep the player's slot. Consoles require this; do it everywhere.
- Assign players to pads on first button press ("Press A to join"), not by index (indices shuffle on reconnect).

## Touch (mobile)
Floating virtual stick on the left half (spawns under the thumb), radius 60–80 dp, 10 % deadzone, knob clamped to radius; action buttons ≥ 48 dp (Android) / 44 pt (iOS) in the right thumb arc, 8+ dp apart. Use Pointer Events with `setPointerCapture`, track by `pointerId`, `touch-action: none` on the canvas. Auto-hide touch UI when a gamepad or keyboard is used; respect safe-area insets. Prefer gestures (tap, swipe, drag) over many virtual buttons.

## Keyboard + mouse
- Bind by **physical key** (`KeyboardEvent.code`, e.g. `KeyW`) so AZERTY/Dvorak players get the same positions; display the layout-local label (`event.key`, or `navigator.keyboard.getLayoutMap()` in Chromium).
- Mouse look: Pointer Lock (`canvas.requestPointerLock({ unadjustedMovement: true })` where supported = raw input), sensitivity in degrees per count, separate X/Y and ADS sensitivity, invert-Y option.
- Defaults: WASD + Space/Shift/Ctrl/E/Q/R/F/Tab/Esc; Esc always opens pause/back and is not rebindable; don't put essential actions on keys far from WASD.

## Rebinding UX
Per-device-family binding lists → select action → "Press a key/button… (Esc to cancel, 5 s timeout)" → on conflict, offer **swap** (default) or unbind the other → "Reset to defaults" (per action and all) → persist JSON per device family. Allow two bindings per action on keyboard. Ignore stick drift while listening (require > 0.6). Show the new glyph immediately.

## Hold vs toggle and accessibility
- Every hold action (sprint, aim, crouch, charge, interact-hold) gets a hold/toggle setting. Replace button-mashing with "hold" option; QTE timing extend or auto-complete.
- Remap **everything** including menu actions; this is what makes the Xbox Adaptive Controller and PlayStation Access controller work (they present as standard pads and depend on remapping). Support one-handed layouts and copilot-style two-pad input (system-level on Xbox).
- Sensitivity, deadzone, invert X/Y, vibration intensity, aim assist strength, input timing windows.

## Godot 4
InputMap actions in Project Settings → Input Map (each action has its own deadzone, default 0.5; use ~0.2 for movement). Read with `Input.get_vector("move_left","move_right","move_up","move_down")` (radial deadzone). `JOY_BUTTON_A` etc. are positional (A = bottom). Godot embeds the SDL GameController DB; add more with `Input.add_joy_mapping(mapping_string, true)`.
```gdscript
extends Node  # autoload "InputGlyphs"
signal device_changed(family: String)
var family := "keyboard"
func _ready() -> void:
    Input.joy_connection_changed.connect(_on_joy_changed)
func _input(e: InputEvent) -> void:
    var f := family
    if e is InputEventKey or e is InputEventMouseButton: f = "keyboard"
    elif e is InputEventJoypadButton or (e is InputEventJoypadMotion and absf(e.axis_value) > 0.4):
        f = _family(Input.get_joy_name(e.device))
    if f != family: family = f; device_changed.emit(f)
func _family(n: String) -> String:
    n = n.to_lower()
    if "ps" in n or "dualsense" in n or "dualshock" in n: return "playstation"
    if "nintendo" in n or "switch" in n or "joy-con" in n: return "switch"
    return "xbox"
func _on_joy_changed(device: int, connected: bool) -> void:
    if not connected: get_tree().paused = true  # show reconnect overlay (process_mode ALWAYS)
func rumble(device: int, weak := 0.3, strong := 0.7, secs := 0.15) -> void:
    Input.start_joy_vibration(device, weak, strong, secs)
```
Rebinding: `InputMap.action_erase_events(a)` / `action_add_event(a, ev)` with the captured `InputEventKey`/`InputEventJoypadButton`; save to `user://` as a ConfigFile.

## Unity (Input System package)
Input Actions asset → action maps (`Gameplay`, `UI`) → actions with bindings; control schemes (`Keyboard&Mouse`, `Gamepad`, `Touch`). `PlayerInput` component gives `currentControlScheme` and a controls-changed event for glyph switching. Device layouts: `Gamepad` (buttonSouth/East/West/North), `XInputController`, `DualShockGamepad` (DualSense derives from it; `SetLightBarColor`), Switch Pro HID layout. Rumble: `Gamepad.current?.SetMotorSpeeds(low, high)` then `ResetHaptics()`; `InputSystem.PauseHaptics()` on pause. Disconnect: `InputSystem.onDeviceChange += (d, c) => { if (c == InputDeviceChange.Disconnected) Pause(); }`.
```csharp
using UnityEngine.InputSystem;
InputActionRebindingExtensions.RebindingOperation op;
public void Rebind(InputAction action, int bindingIndex) {
    action.Disable();
    op = action.PerformInteractiveRebinding(bindingIndex)
        .WithControlsExcluding("<Mouse>/position")
        .WithCancelingThrough("<Keyboard>/escape")
        .OnMatchWaitForAnother(0.1f)
        .OnComplete(o => { o.Dispose(); action.Enable();
            PlayerPrefs.SetString("binds", action.actionMap.asset.SaveBindingOverridesAsJson()); })
        .OnCancel(o => { o.Dispose(); action.Enable(); })
        .Start();
}
// on boot: asset.LoadBindingOverridesFromJson(PlayerPrefs.GetString("binds"));
// label:   action.GetBindingDisplayString(bindingIndex)
```

## Unreal (Enhanced Input + CommonUI)
Input Action assets (value type bool/Axis1D/Axis2D) + Input Mapping Contexts added with priority via the Enhanced Input local-player subsystem (`AddMappingContext(ctx, priority)`); swap contexts for gameplay/vehicle/menu. Modifiers (Dead Zone radial/axial, Negate, Swizzle, response curves) and Triggers (Pressed, Hold, Tap, Chorded). Player-mappable key settings drive remapping screens. CommonUI: the common input subsystem reports the current input type; controller data assets per platform/gamepad supply glyph icons; action widgets show the right glyph automatically. Rumble via Force Feedback Effect assets played on the player controller.

## SDL3 (native C/C++, also under many engines)
`SDL_Init(SDL_INIT_GAMEPAD)`; handle `SDL_EVENT_GAMEPAD_ADDED/REMOVED`; `SDL_OpenGamepad(id)`; `SDL_GetGamepadButton(pad, SDL_GAMEPAD_BUTTON_SOUTH)` (positional names SOUTH/EAST/WEST/NORTH); `SDL_GetGamepadAxis` returns −32768…32767 (triggers 0…32767); `SDL_GetGamepadType` → PS4/PS5/Xbox/Switch Pro/Joy-Con types; `SDL_GetGamepadButtonLabel` tells you what is printed on the button (A/B/Cross/Circle…) — use it for glyphs. `SDL_RumbleGamepad(pad, low, high, ms)`, `SDL_RumbleGamepadTriggers`, `SDL_SetGamepadLED`. Load community mappings with `SDL_AddGamepadMappingsFromFile("gamecontrollerdb.txt")` (gamecontrollerdb on GitHub, keyed by GUID; refresh it each release).

## Steam Input (PC, Steam Deck)
Define an in-game actions file: action sets (`Gameplay`, `Menu`, `Vehicle`) with digital and analog actions; ship a default configuration per controller type. Each frame: run the input frame, activate the current action set, read digital/analog action data. Glyphs: query the origins bound to an action and request the official glyph image for that origin — always correct for whatever the player physically holds and however they remapped. Call the binding panel API to open Steam's remap UI. Gotcha: if your game doesn't use the API, Steam Input may present every controller as a virtual Xbox pad (vendor 28de / XInput) — your game will then show Xbox glyphs for a DualSense; prefer the API or ask Steam for the real controller type. Steam Deck: controller-first, default layout must work with no config.
