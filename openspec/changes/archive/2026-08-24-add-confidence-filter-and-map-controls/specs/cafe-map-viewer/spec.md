## ADDED Requirements

### Requirement: ズームレベルに応じたconfidenceフィルタ
システムはカフェ・喫茶店POIのシンボルレイヤに、現在のズームレベルに応じた`confidence`しきい値以上のPOIのみを表示するフィルタを適用しなければならない(SHALL)。しきい値はズームレベル10以上14以下では0.99以上、15では0.97以上、16では0.95以上、17以上では0.90以上とする。

#### Scenario: z10-14ではconfidence0.99以上のPOIのみ表示される
- **WHEN** ユーザーが地図をズームレベル10から14の範囲内で表示する
- **THEN** confidenceが0.99未満のPOIシンボルは表示されない

#### Scenario: z15ではconfidence0.97以上のPOIのみ表示される
- **WHEN** ユーザーが地図をズームレベル15で表示する
- **THEN** confidenceが0.97未満のPOIシンボルは表示されない

#### Scenario: z16ではconfidence0.95以上のPOIのみ表示される
- **WHEN** ユーザーが地図をズームレベル16で表示する
- **THEN** confidenceが0.95未満のPOIシンボルは表示されない

#### Scenario: z17以上ではconfidence0.90以上のPOIが表示される
- **WHEN** ユーザーが地図をズームレベル17以上で表示する
- **THEN** confidenceが0.90以上のPOIシンボルはすべて表示される

### Requirement: ナビゲーションコントロールの表示
システムは地図右上にMapLibreのナビゲーションコントロール(ズームイン・ズームアウト・コンパス操作を含む)を表示しなければならない(SHALL)。

#### Scenario: 初期表示でナビゲーションコントロールが地図右上に表示される
- **WHEN** ユーザーがマップページを開く
- **THEN** 地図右上にズームイン・ズームアウト・コンパス操作ボタンを含むナビゲーションコントロールが表示される

#### Scenario: ナビゲーションコントロールのズームボタン操作で地図がズームする
- **WHEN** ユーザーがナビゲーションコントロールのズームインボタンをクリックする
- **THEN** 地図のズームレベルが1段階拡大される

### Requirement: 地図状態のURLハッシュ同期
システムは地図の中心座標・ズームレベル・回転・傾きをURLのハッシュ部分に反映し、ハッシュ部分に地図状態を含むURLで開かれた際にはその状態から地図を初期化しなければならない(SHALL)。

#### Scenario: 地図を操作するとURLハッシュが更新される
- **WHEN** ユーザーが地図をパンまたはズームする
- **THEN** ブラウザのURLハッシュが操作後の地図の中心座標・ズーム・回転・傾きを反映して更新される

#### Scenario: ハッシュ付きURLを開くと指定位置で地図が初期化される
- **WHEN** ユーザーが中心座標・ズームを指定したハッシュ付きURLでマップページを開く
- **THEN** 地図はそのハッシュが示す中心座標・ズームで初期化される

### Requirement: POI名ラベルの表示
システムはカフェ・喫茶店POIのシンボルに、店名等のラベルをテキストとして表示しなければならない(SHALL)。ラベルはアイコンの右への配置を優先し、右側に配置すると他のラベルと衝突する場合はアイコンの下に配置しなければならない(SHALL)。ラベルの表示にはグリフフォントソース`https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf`のNoto Sans Regularを使用しなければならない(SHALL)。

#### Scenario: POIシンボルの右にラベルが表示される
- **WHEN** 周囲の他のPOIラベルと衝突しない状態でカフェ・喫茶店POIシンボルを表示する
- **THEN** 当該POIのアイコンの右にラベルが表示される

#### Scenario: ラベルが衝突する場合はアイコンの下に表示される
- **WHEN** アイコンの右にラベルを配置すると他のPOIのラベルと衝突する
- **THEN** 当該POIのラベルはアイコンの下に配置される

#### Scenario: 店名が無いPOIではブランド名がラベルとして表示される
- **WHEN** 店名を持たないがブランド名を持つPOIを表示する
- **THEN** 当該POIのアイコンのラベルにはブランド名が表示される

### Requirement: Overture Mapsへの帰属表示
システムは地図上に、カフェ・喫茶店POIデータの出典であるOverture Maps Foundationへの帰属表示(attribution)を含めなければならない(SHALL)。

#### Scenario: 初期表示でOverture Mapsの帰属表示が含まれる
- **WHEN** ユーザーがマップページを開く
- **THEN** 地図の帰属表示にOverture Maps Foundationへのクレジットが含まれる

## MODIFIED Requirements

### Requirement: 背景地図の表示
システムはMapLibre GL JS v6を用いて、透過度0.50のOpenStreetMap Standard背景地図を表示しなければならない(SHALL)。

#### Scenario: 初期表示で背景地図が読み込まれる
- **WHEN** ユーザーがマップページを開く
- **THEN** OpenStreetMap Standardの背景タイルが表示された状態でマップが初期化される

#### Scenario: 背景地図が半透明で表示される
- **WHEN** ユーザーがマップページを開く
- **THEN** OpenStreetMap Standardの背景タイルは透過度0.50(不透明度50%)で表示される

### Requirement: POIクリック時のプロパティポップアップ
システムはユーザーがカフェ・喫茶店POIのシンボルをクリックした際、そのPOIが保持する各種プロパティ(店名・ブランド・住所・confidence・websites等)をポップアップとして表示しなければならない(SHALL)。`confidence`は表示する場合、数値をそのまま表示するのではなく百分率(%)に変換して表示しなければならない(SHALL)。`websites`は表示する場合、各URLをクリック可能なリンクとして表示しなければならない(SHALL)。

#### Scenario: POIシンボルをクリックするとポップアップが表示される
- **WHEN** ユーザーが地図上のカフェ・喫茶店POIシンボルをクリックする
- **THEN** クリックしたPOIのプロパティ(店名を含む)を表示するポップアップが地図上に表示される

#### Scenario: 何もない場所をクリックしてもポップアップは表示されない
- **WHEN** ユーザーがPOIシンボルが存在しない地図上の地点をクリックする
- **THEN** ポップアップは表示されない

#### Scenario: ポップアップにconfidenceが百分率で表示される
- **WHEN** ユーザーが`confidence`を保持するPOIシンボルをクリックする
- **THEN** ポップアップに当該POIのconfidenceが百分率(%)として表示される

#### Scenario: ポップアップにwebsitesがリンクとして表示される
- **WHEN** ユーザーが`websites`を保持するPOIシンボルをクリックする
- **THEN** ポップアップに当該POIのwebsitesの各URLがクリック可能なリンクとして表示される

#### Scenario: websitesを持たないPOIではリンクが表示されない
- **WHEN** ユーザーが`websites`を保持しないPOIシンボルをクリックする
- **THEN** ポップアップにwebsitesのリンクは表示されない
