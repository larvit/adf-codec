# What each call writes

`feature-table/build.mjs` writes this page from the corpus and the built package, and `./ci.sh` fails where the page differs.

Each output is read back by its format's reader. `holds` means that gives the same document, `loses` a different one, and `refused` an error whose code the example names.

| Example | Lossless | Portable | HTML |
| --- | --- | --- | --- |
| [Bold instruction with a command in it](#bold-instruction-with-a-command-in-it) | holds | holds | holds |
| [Emphasis and strikethrough](#emphasis-and-strikethrough) | holds | holds | holds |
| [Headings](#headings) | holds | holds | holds |
| [Bullet list](#bullet-list) | holds | holds | holds |
| [Code block](#code-block) | holds | holds | holds |
| [Quote](#quote) | holds | holds | holds |
| [Link](#link) | holds | holds | holds |
| [Table](#table) | holds | holds | holds |
| [Panels](#panels) | holds | loses | holds |
| [Task list](#task-list) | holds | loses | holds |
| [Image](#image) | holds | holds | holds |
| [Mention](#mention) | holds | loses | holds |
| [Status](#status) | holds | loses | holds |
| [Date](#date) | holds | loses | holds |
| [Node types this version does not know](#node-types-this-version-does-not-know) | holds | loses | holds |

## Bold instruction with a command in it

ADF:

```json
{"content":[{"content":[{"marks":[{"type":"strong"}],"text":"Run ","type":"text"},{"marks":[{"type":"code"}],"text":"npm ci","type":"text"},{"marks":[{"type":"strong"}],"text":" first","type":"text"}],"type":"paragraph"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

```markdown
**Run `npm ci` first**
```

`adfToPortableMarkdown`, round-trip holds:

```markdown
**Run `npm ci` first**
```

`adfToHtml`, round-trip holds:

```html
<p><strong>Run </strong><code>npm ci</code><strong> first</strong></p>
```

## Emphasis and strikethrough

ADF:

```json
{"content":[{"content":[{"text":"Read the ","type":"text"},{"marks":[{"type":"em"}],"text":"manual","type":"text"},{"text":" before ","type":"text"},{"marks":[{"type":"strong"}],"text":"wiring","type":"text"},{"text":" the ","type":"text"},{"marks":[{"type":"strike"}],"text":"relay","type":"text"},{"text":".","type":"text"}],"type":"paragraph"},{"content":[{"text":"An un","type":"text"},{"marks":[{"type":"em"}],"text":"real","type":"text"},{"text":"istic goal.","type":"text"}],"type":"paragraph"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

```markdown
Read the _manual_ before **wiring** the ~~relay~~.

An un*real*istic goal.
```

`adfToPortableMarkdown`, round-trip holds:

```markdown
Read the _manual_ before **wiring** the ~~relay~~.

An un*real*istic goal.
```

`adfToHtml`, round-trip holds:

```html
<p>Read the <em>manual</em> before <strong>wiring</strong> the <span class="adf-carry" data-adf="{&quot;marks&quot;:[{&quot;type&quot;:&quot;strike&quot;}],&quot;text&quot;:&quot;relay&quot;,&quot;type&quot;:&quot;text&quot;}">relay</span>.</p>
<p>An un<em>real</em>istic goal.</p>
```

## Headings

ADF:

```json
{"content":[{"attrs":{"level":1},"content":[{"text":"Assembly","type":"text"}],"type":"heading"},{"attrs":{"level":2},"content":[{"text":"Parts","type":"text"}],"type":"heading"},{"attrs":{"level":3},"content":[{"text":"Fasteners","type":"text"}],"type":"heading"},{"attrs":{"level":4},"content":[{"text":"Bolts","type":"text"}],"type":"heading"},{"attrs":{"level":5},"content":[{"text":"Sizes","type":"text"}],"type":"heading"},{"attrs":{"level":6},"content":[{"text":"M8","type":"text"}],"type":"heading"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

```markdown
# Assembly

## Parts

### Fasteners

#### Bolts

##### Sizes

###### M8
```

`adfToPortableMarkdown`, round-trip holds:

```markdown
# Assembly

## Parts

### Fasteners

#### Bolts

##### Sizes

###### M8
```

`adfToHtml`, round-trip holds:

```html
<h1>Assembly</h1>
<h2>Parts</h2>
<h3>Fasteners</h3>
<h4>Bolts</h4>
<h5>Sizes</h5>
<h6>M8</h6>
```

## Bullet list

ADF:

```json
{"content":[{"content":[{"content":[{"content":[{"text":"Bolt M8","type":"text"}],"type":"paragraph"}],"type":"listItem"},{"content":[{"content":[{"text":"Nut M8","type":"text"}],"type":"paragraph"}],"type":"listItem"},{"content":[{"content":[{"text":"Washer M8","type":"text"}],"type":"paragraph"},{"content":[{"content":[{"content":[{"text":"Fibre","type":"text"}],"type":"paragraph"}],"type":"listItem"}],"type":"bulletList"}],"type":"listItem"}],"type":"bulletList"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

```markdown
- Bolt M8
- Nut M8
- Washer M8
  - Fibre
```

`adfToPortableMarkdown`, round-trip holds:

```markdown
- Bolt M8
- Nut M8
- Washer M8
  - Fibre
```

`adfToHtml`, round-trip holds:

```html
<ul>
<li>Bolt M8</li>
<li>Nut M8</li>
<li>Washer M8
<ul>
<li>Fibre</li>
</ul>
</li>
</ul>
```

## Code block

ADF:

```json
{"content":[{"attrs":{"language":"sql"},"content":[{"text":"SELECT id\nFROM part\nWHERE qty > 0;\n- 1. the markers a container start would claim","type":"text"}],"type":"codeBlock"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

````markdown
```sql
SELECT id
FROM part
WHERE qty > 0;
- 1. the markers a container start would claim
```
````

`adfToPortableMarkdown`, round-trip holds:

````markdown
```sql
SELECT id
FROM part
WHERE qty > 0;
- 1. the markers a container start would claim
```
````

`adfToHtml`, round-trip holds:

```html
<pre><code class="language-sql">SELECT id
FROM part
WHERE qty &gt; 0;
- 1. the markers a container start would claim</code></pre>
```

## Quote

ADF:

```json
{"content":[{"content":[{"content":[{"text":"Ship it.","type":"text"}],"type":"paragraph"},{"content":[{"text":"Then tell them.","type":"text"}],"type":"paragraph"}],"type":"blockquote"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

```markdown
> Ship it.
>
> Then tell them.
```

`adfToPortableMarkdown`, round-trip holds:

```markdown
> Ship it.
>
> Then tell them.
```

`adfToHtml`, round-trip holds:

```html
<blockquote>
<p>Ship it.</p>
<p>Then tell them.</p>
</blockquote>
```

## Link

ADF:

```json
{"content":[{"content":[{"text":"See ","type":"text"},{"marks":[{"attrs":{"href":"https://example.com/changelog"},"type":"link"}],"text":"the changelog","type":"text"},{"text":".","type":"text"}],"type":"paragraph"},{"content":[{"marks":[{"attrs":{"href":"https://example.com/"},"type":"link"}],"text":"https://example.com/","type":"text"}],"type":"paragraph"},{"content":[{"text":"Read ","type":"text"},{"marks":[{"attrs":{"href":"https://example.com/guide","title":"Setup guide"},"type":"link"}],"text":"the guide","type":"text"},{"text":".","type":"text"}],"type":"paragraph"},{"content":[{"text":"Open ","type":"text"},{"marks":[{"attrs":{"href":"https://example.com/the plan.pdf"},"type":"link"}],"text":"the plan","type":"text"},{"text":".","type":"text"}],"type":"paragraph"},{"content":[{"marks":[{"attrs":{"href":"/parts/m8"},"type":"link"}],"text":"/parts/m8","type":"text"}],"type":"paragraph"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

```markdown
See [the changelog](https://example.com/changelog).

<https://example.com/>

Read [the guide](https://example.com/guide "Setup guide").

Open [the plan](<https://example.com/the plan.pdf>).

[/parts/m8](/parts/m8)
```

`adfToPortableMarkdown`, round-trip holds:

```markdown
See [the changelog](https://example.com/changelog).

<https://example.com/>

Read [the guide](https://example.com/guide "Setup guide").

Open [the plan](<https://example.com/the plan.pdf>).

[/parts/m8](/parts/m8)
```

`adfToHtml`, round-trip holds:

```html
<p>See <a href="https://example.com/changelog">the changelog</a>.</p>
<p><a href="https://example.com/">https://example.com/</a></p>
<p>Read <a href="https://example.com/guide" title="Setup guide">the guide</a>.</p>
<p>Open <a href="https://example.com/the plan.pdf">the plan</a>.</p>
<p><a href="/parts/m8">/parts/m8</a></p>
```

## Table

ADF:

```json
{"content":[{"content":[{"content":[{"content":[{"content":[{"text":"Part","type":"text"}],"type":"paragraph"}],"type":"tableHeader"},{"content":[{"content":[{"text":"Stock","type":"text"}],"type":"paragraph"}],"type":"tableHeader"}],"type":"tableRow"},{"content":[{"content":[{"content":[{"text":"Bolt M8","type":"text"}],"type":"paragraph"}],"type":"tableCell"},{"content":[{"content":[{"text":"120","type":"text"}],"type":"paragraph"}],"type":"tableCell"}],"type":"tableRow"},{"content":[{"content":[{"content":[{"text":"Washer M8","type":"text"}],"type":"paragraph"}],"type":"tableCell"},{"content":[{"content":[{"text":"45","type":"text"}],"type":"paragraph"}],"type":"tableCell"}],"type":"tableRow"}],"type":"table"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

```markdown
| Part | Stock |
| --- | --- |
| Bolt M8 | 120 |
| Washer M8 | 45 |
```

`adfToPortableMarkdown`, round-trip holds:

```markdown
| Part | Stock |
| --- | --- |
| Bolt M8 | 120 |
| Washer M8 | 45 |
```

`adfToHtml`, round-trip holds:

```html
<table>
<thead>
<tr><th>Part</th><th>Stock</th></tr>
</thead>
<tbody>
<tr><td>Bolt M8</td><td>120</td></tr>
<tr><td>Washer M8</td><td>45</td></tr>
</tbody>
</table>
```

## Panels

ADF:

```json
{"content":[{"attrs":{"panelType":"warning"},"content":[{"content":[{"text":"Check the collation before importing.","type":"text"}],"type":"paragraph"}],"type":"panel"},{"attrs":{"localId":"01a0337c-561a-75aa-b629-3801f68839ad","panelType":"info"},"content":[{"content":[{"text":"Backups run at 02:00.","type":"text"}],"type":"paragraph"}],"type":"panel"},{"attrs":{"panelColor":"#c9372c","panelIcon":":rainbow:","panelIconId":"1f308","panelIconText":"🌈","panelType":"custom"},"content":[{"content":[{"text":"Weather permitting.","type":"text"}],"type":"paragraph"}],"type":"panel"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

```markdown
!adf:panel warning
Check the collation before importing.
!adf:/panel

!adf:panel info {localId=01a0337c-561a-75aa-b629-3801f68839ad}
Backups run at 02:00.
!adf:/panel

!adf:panel custom {panelColor="#c9372c" panelIcon=":rainbow:" panelIconId=1f308 panelIconText="🌈"}
Weather permitting.
!adf:/panel
```

`adfToPortableMarkdown`, round-trip loses:

```markdown
> [!WARNING]
>
> Check the collation before importing.

> [!NOTE]
>
> Backups run at 02:00.

> [!NOTE]
>
> Weather permitting.
```

`adfToHtml`, round-trip holds:

```html
<div class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;panelType&quot;:&quot;warning&quot;},&quot;content&quot;:[{&quot;content&quot;:[{&quot;text&quot;:&quot;Check the collation before importing.&quot;,&quot;type&quot;:&quot;text&quot;}],&quot;type&quot;:&quot;paragraph&quot;}],&quot;type&quot;:&quot;panel&quot;}"><p>Check the collation before importing.</p></div>
<div class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;localId&quot;:&quot;01a0337c-561a-75aa-b629-3801f68839ad&quot;,&quot;panelType&quot;:&quot;info&quot;},&quot;content&quot;:[{&quot;content&quot;:[{&quot;text&quot;:&quot;Backups run at 02:00.&quot;,&quot;type&quot;:&quot;text&quot;}],&quot;type&quot;:&quot;paragraph&quot;}],&quot;type&quot;:&quot;panel&quot;}"><p>Backups run at 02:00.</p></div>
<div class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;panelColor&quot;:&quot;#c9372c&quot;,&quot;panelIcon&quot;:&quot;:rainbow:&quot;,&quot;panelIconId&quot;:&quot;1f308&quot;,&quot;panelIconText&quot;:&quot;🌈&quot;,&quot;panelType&quot;:&quot;custom&quot;},&quot;content&quot;:[{&quot;content&quot;:[{&quot;text&quot;:&quot;Weather permitting.&quot;,&quot;type&quot;:&quot;text&quot;}],&quot;type&quot;:&quot;paragraph&quot;}],&quot;type&quot;:&quot;panel&quot;}"><p>Weather permitting.</p></div>
```

## Task list

ADF:

```json
{"content":[{"attrs":{"localId":"0198f3a2-7c41-7f2e-9b3a-4d8e2c1a6b90"},"content":[{"attrs":{"localId":"0198f3a2-8d52-70b1-8c4f-5e9f3d2b7ca1","state":"DONE"},"content":[{"text":"Write the spec","type":"text"}],"type":"taskItem"},{"attrs":{"localId":"0198f3a2-9e63-7d80-a15b-6fa04e3c8db2","state":"TODO"},"content":[{"text":"Ship it","type":"text"}],"type":"taskItem"},{"attrs":{"localId":"01a033b2-95c8-7d62-9b9c-dee7ad510982","state":"TODO"},"content":[{"content":[{"text":"Check the torque.","type":"text"}],"type":"paragraph"},{"content":[{"text":"Then sign off.","type":"text"}],"type":"paragraph"}],"type":"blockTaskItem"},{"attrs":{"localId":"01a033b3-d1fa-7489-8c9f-f5846d2c249d"},"content":[{"attrs":{"localId":"01a033bd-a22d-7fb5-be9d-89d1aa261112","state":"TODO"},"content":[{"text":"Nested step","type":"text"}],"type":"taskItem"},{"attrs":{"state":"TODO"},"type":"taskItem"}],"type":"taskList"}],"type":"taskList"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

```markdown
!adf:taskList {localId=0198f3a2-7c41-7f2e-9b3a-4d8e2c1a6b90}
!adf:taskItem DONE {localId=0198f3a2-8d52-70b1-8c4f-5e9f3d2b7ca1}
Write the spec
!adf:/taskItem
!adf:taskItem TODO {localId=0198f3a2-9e63-7d80-a15b-6fa04e3c8db2}
Ship it
!adf:/taskItem
!adf:blockTaskItem TODO {localId=01a033b2-95c8-7d62-9b9c-dee7ad510982}
Check the torque.

Then sign off.
!adf:/blockTaskItem
!adf:taskList {localId=01a033b3-d1fa-7489-8c9f-f5846d2c249d}
!adf:taskItem TODO {localId=01a033bd-a22d-7fb5-be9d-89d1aa261112}
Nested step
!adf:/taskItem
!adf:taskItem TODO
!adf:/taskItem
!adf:/taskList
!adf:/taskList
```

`adfToPortableMarkdown`, round-trip loses:

```markdown
- [x] Write the spec
- [ ] Ship it
- [ ] Check the torque.

  Then sign off.
  - [ ] Nested step
  - [ ]
```

`adfToHtml`, round-trip holds:

```html
<div class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;localId&quot;:&quot;0198f3a2-7c41-7f2e-9b3a-4d8e2c1a6b90&quot;},&quot;content&quot;:[{&quot;attrs&quot;:{&quot;localId&quot;:&quot;0198f3a2-8d52-70b1-8c4f-5e9f3d2b7ca1&quot;,&quot;state&quot;:&quot;DONE&quot;},&quot;content&quot;:[{&quot;text&quot;:&quot;Write the spec&quot;,&quot;type&quot;:&quot;text&quot;}],&quot;type&quot;:&quot;taskItem&quot;},{&quot;attrs&quot;:{&quot;localId&quot;:&quot;0198f3a2-9e63-7d80-a15b-6fa04e3c8db2&quot;,&quot;state&quot;:&quot;TODO&quot;},&quot;content&quot;:[{&quot;text&quot;:&quot;Ship it&quot;,&quot;type&quot;:&quot;text&quot;}],&quot;type&quot;:&quot;taskItem&quot;},{&quot;attrs&quot;:{&quot;localId&quot;:&quot;01a033b2-95c8-7d62-9b9c-dee7ad510982&quot;,&quot;state&quot;:&quot;TODO&quot;},&quot;content&quot;:[{&quot;content&quot;:[{&quot;text&quot;:&quot;Check the torque.&quot;,&quot;type&quot;:&quot;text&quot;}],&quot;type&quot;:&quot;paragraph&quot;},{&quot;content&quot;:[{&quot;text&quot;:&quot;Then sign off.&quot;,&quot;type&quot;:&quot;text&quot;}],&quot;type&quot;:&quot;paragraph&quot;}],&quot;type&quot;:&quot;blockTaskItem&quot;},{&quot;attrs&quot;:{&quot;localId&quot;:&quot;01a033b3-d1fa-7489-8c9f-f5846d2c249d&quot;},&quot;content&quot;:[{&quot;attrs&quot;:{&quot;localId&quot;:&quot;01a033bd-a22d-7fb5-be9d-89d1aa261112&quot;,&quot;state&quot;:&quot;TODO&quot;},&quot;content&quot;:[{&quot;text&quot;:&quot;Nested step&quot;,&quot;type&quot;:&quot;text&quot;}],&quot;type&quot;:&quot;taskItem&quot;},{&quot;attrs&quot;:{&quot;state&quot;:&quot;TODO&quot;},&quot;type&quot;:&quot;taskItem&quot;}],&quot;type&quot;:&quot;taskList&quot;}],&quot;type&quot;:&quot;taskList&quot;}"><p>Write the spec</p><p>Ship it</p><p>Check the torque.</p><p>Then sign off.</p><p>Nested step</p></div>
```

## Image

ADF:

```json
{"content":[{"content":[{"text":"Taken from the roof last night.","type":"text"}],"type":"paragraph"},{"attrs":{"layout":"center"},"content":[{"attrs":{"alt":"The moon, at night.","type":"external","url":"https://example.com/moon.png"},"type":"media"}],"type":"mediaSingle"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

```markdown
Taken from the roof last night.

![The moon, at night.](https://example.com/moon.png)
```

`adfToPortableMarkdown`, round-trip holds:

```markdown
Taken from the roof last night.

![The moon, at night.](https://example.com/moon.png)
```

`adfToHtml`, round-trip holds:

```html
<p>Taken from the roof last night.</p>
<p><img src="https://example.com/moon.png" alt="The moon, at night."></p>
```

## Mention

ADF:

```json
{"content":[{"content":[{"text":"Ping ","type":"text"},{"attrs":{"accessLevel":"CONTAINER","id":"01a032c3-7a7c-775f-a730-2d79351338b4","localId":"01a033ad-ecb7-7530-aa1c-ff25031e96e2","text":"@Mikael","userType":"DEFAULT"},"type":"mention"},{"text":" before merging.","type":"text"}],"type":"paragraph"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

```markdown
Ping !adf:mention[@Mikael]{accessLevel=CONTAINER id=01a032c3-7a7c-775f-a730-2d79351338b4 localId=01a033ad-ecb7-7530-aa1c-ff25031e96e2 userType=DEFAULT} before merging.
```

`adfToPortableMarkdown`, round-trip loses:

```markdown
Ping @Mikael before merging.
```

`adfToHtml`, round-trip holds:

```html
<p>Ping <span class="adf-mention" data-access-level="CONTAINER" data-id="01a032c3-7a7c-775f-a730-2d79351338b4" data-local-id="01a033ad-ecb7-7530-aa1c-ff25031e96e2" data-user-type="DEFAULT">@Mikael</span> before merging.</p>
```

## Status

ADF:

```json
{"content":[{"content":[{"text":"The rebuild is ","type":"text"},{"attrs":{"color":"yellow","localId":"01a033a7-d68a-71a9-a58a-edf5757ad176","style":"bold","text":"In review"},"type":"status"},{"text":" until Friday.","type":"text"}],"type":"paragraph"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

```markdown
The rebuild is !adf:status[In review]{color=yellow localId=01a033a7-d68a-71a9-a58a-edf5757ad176 style=bold} until Friday.
```

`adfToPortableMarkdown`, round-trip loses:

```markdown
The rebuild is In review until Friday.
```

`adfToHtml`, round-trip holds:

```html
<p>The rebuild is <span class="adf-status" data-color="yellow" data-local-id="01a033a7-d68a-71a9-a58a-edf5757ad176" data-style="bold">In review</span> until Friday.</p>
```

## Date

ADF:

```json
{"content":[{"content":[{"text":"Due ","type":"text"},{"attrs":{"timestamp":"1756080000000"},"type":"date"},{"text":", reviewed ","type":"text"},{"attrs":{"localId":"01a033ab-781c-7f79-9c8a-fb63356c1cad","timestamp":"1735689600000"},"type":"date"},{"text":".","type":"text"}],"type":"paragraph"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

```markdown
Due !adf:date{timestamp=1756080000000}, reviewed !adf:date{localId=01a033ab-781c-7f79-9c8a-fb63356c1cad timestamp=1735689600000}.
```

`adfToPortableMarkdown`, round-trip loses:

```markdown
Due 2025-08-25, reviewed 2025-01-01.
```

`adfToHtml`, round-trip holds:

```html
<p>Due <time class="adf-date" datetime="2025-08-25" data-timestamp="1756080000000">2025-08-25</time>, reviewed <time class="adf-date" datetime="2025-01-01" data-local-id="01a033ab-781c-7f79-9c8a-fb63356c1cad" data-timestamp="1735689600000">2025-01-01</time>.</p>
```

## Node types this version does not know

ADF:

```json
{"content":[{"attrs":{"url":"https://example.com/roadmap"},"type":"blockCard"},{"attrs":{"panelType":"info"},"content":[{"content":[{"text":"The card below has no spelling yet.","type":"text"}],"type":"paragraph"},{"attrs":{"layout":"wide","url":"https://example.com/board","width":100},"type":"embedCard"}],"type":"panel"}],"type":"doc","version":1}
```

`adfToLosslessMarkdown`, round-trip holds:

````markdown
```adf:blockCard
{
  "attrs": {
    "url": "https://example.com/roadmap"
  }
}
```

!adf:panel info
The card below has no spelling yet.

```adf:embedCard
{
  "attrs": {
    "layout": "wide",
    "url": "https://example.com/board",
    "width": 100
  }
}
```
!adf:/panel
````

`adfToPortableMarkdown`, round-trip loses:

```markdown
<https://example.com/roadmap>

> [!NOTE]
>
> The card below has no spelling yet.
>
> <https://example.com/board>
```

`adfToHtml`, round-trip holds:

```html
<div class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;url&quot;:&quot;https://example.com/roadmap&quot;},&quot;type&quot;:&quot;blockCard&quot;}"><p><a href="https://example.com/roadmap">https://example.com/roadmap</a></p></div>
<div class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;panelType&quot;:&quot;info&quot;},&quot;content&quot;:[{&quot;content&quot;:[{&quot;text&quot;:&quot;The card below has no spelling yet.&quot;,&quot;type&quot;:&quot;text&quot;}],&quot;type&quot;:&quot;paragraph&quot;},{&quot;attrs&quot;:{&quot;layout&quot;:&quot;wide&quot;,&quot;url&quot;:&quot;https://example.com/board&quot;,&quot;width&quot;:100},&quot;type&quot;:&quot;embedCard&quot;}],&quot;type&quot;:&quot;panel&quot;}"><p>The card below has no spelling yet.</p><p><a href="https://example.com/board">https://example.com/board</a></p></div>
```
