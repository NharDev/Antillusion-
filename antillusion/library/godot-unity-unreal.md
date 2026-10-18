# Game engines quick reference: Godot 4, Unity, Unreal, and how to choose
tags: godot gdscript unity c# unreal blueprints engine export 2d 3d game dev scene node signal prefab scriptableobject character controller input system steam android اتش غودوت يونيتي انريل محرك العاب سكربت مشهد عقده بريفاب تصدير

## Choose
| Need | Pick |
|---|---|
| Instant sharing, tiny jam/arcade games, no install | **Browser** (Canvas/Phaser/three.js) |
| 2D game, open source, light, great workflow | **Godot 4** (GDScript, also C#) |
| Mobile + 2D/3D, large ecosystem, C# | **Unity** |
| AAA-looking 3D, big teams, Blueprints/C++ | **Unreal 5** |
| Desktop wrapper for a web game | Electron / Tauri |
When the user asks for a *playable now* result in this app, build for the browser; produce engine project files only when they explicitly want Godot/Unity/Unreal.

## Godot 4 (GDScript)
Project = folder with `project.godot`; scenes `.tscn` are node trees; scripts attach to nodes. Signals decouple (`signal died`; `died.emit()`; `enemy.died.connect(_on_enemy_died)`). Groups (`add_to_group("enemies")`, `get_tree().get_nodes_in_group`). Autoloads (Project Settings) for globals (Game, Audio, SaveGame). Resources (`.tres`) for data (items, stats) via `extends Resource` + `@export`.
```gdscript
extends CharacterBody2D
@export var speed := 220.0; @export var jump_velocity := -520.0
var gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")
var coyote := 0.0
func _physics_process(delta: float) -> void:
    if is_on_floor(): coyote = 0.1
    else: coyote -= delta; velocity.y += gravity * delta
    var dir := Input.get_axis("move_left", "move_right")
    velocity.x = move_toward(velocity.x, dir * speed, speed * 8.0 * delta)
    if Input.is_action_just_pressed("jump") and coyote > 0.0: velocity.y = jump_velocity; coyote = 0.0
    move_and_slide()
```
Input map in `project.godot` (`[input]`) or Project Settings; TileMapLayer for levels; AnimationPlayer/AnimatedSprite2D; `Tween` via `create_tween()`; `get_tree().change_scene_to_file("res://scenes/level2.tscn")`; save with `FileAccess` + `JSON.stringify`. Export: install export templates, Project → Export (Windows/Linux/Web/Android); web export needs a server with COOP/COEP headers for threads.

## Unity (C#)
Scene = GameObjects + Components; behaviour in `MonoBehaviour` (`Awake`, `Start`, `Update`, `FixedUpdate` for physics, `OnCollisionEnter2D`). Prefabs for reusable objects, **ScriptableObjects** for data/config/events. New Input System (`InputAction`, `PlayerInput`); Cinemachine for cameras; Addressables for assets; TextMeshPro for text; Tilemap + Rule Tiles for 2D levels; Animator state machines.
```csharp
[RequireComponent(typeof(Rigidbody2D))]
public class Player : MonoBehaviour {
  [SerializeField] float speed = 7f, jump = 12f; Rigidbody2D rb; float coyote;
  void Awake() => rb = GetComponent<Rigidbody2D>();
  void Update() { float x = Input.GetAxisRaw("Horizontal"); rb.velocity = new Vector2(x * speed, rb.velocity.y);
    coyote = IsGrounded() ? 0.1f : coyote - Time.deltaTime; if (Input.GetButtonDown("Jump") && coyote > 0) { rb.velocity = new Vector2(rb.velocity.x, jump); coyote = 0; } }
}
```
Avoid `Find`/`GetComponent` in `Update`; pool with `ObjectPool<T>`; use `Time.deltaTime`; build via File → Build Profiles (Windows/WebGL/Android/iOS).

## Unreal 5
Gameplay framework: GameMode, PlayerController, Pawn/Character, GameState, HUD/UMG widgets. Blueprints for rapid iteration and design, C++ for performance/core systems (`UCLASS`, `UPROPERTY(EditAnywhere)`, `UFUNCTION(BlueprintCallable)`). Enhanced Input for actions, Niagara for VFX, Nanite/Lumen for visuals, Sequencer for cinematics, Behavior Trees + EQS for AI, Gameplay Ability System for RPG abilities.

## Cross-engine design habits
Data-driven content (JSON/Resources/ScriptableObjects), small scenes/prefabs, signals/events instead of hard references, one source of truth for tunables, version control with ignore lists (Godot: `.godot/`; Unity: `Library/ Temp/ Obj/ Logs/`; Unreal: `Intermediate/ Saved/ DerivedDataCache/`), playable build every day.
