# Daftar 100 Monster (draf revisi)

Draf revisi sistem monster (Fase 2B di [PLAN.md](PLAN.md)): **setiap monster punya satu elemen tetap**. Elemen melekat pada jenis monsternya, tidak diacak lagi. Nama dari pemilik (bahasa Inggris); deskripsi, elemen dan cara mendapatkan disusun untuk draf ini. Belum dipasang ke `data/`.

## Aturan ringkas

- **Elemen (13):** Normal, Api, Air, Angin, Tanah, Lightning, Ice, Nature, Dark, Magma, Light, Arcane, Void. Normal netral terhadap semua elemen.
- **Tingkatan (8):** Common → Uncommon → Veteran → Elite → Rare → Epic → Legendary → Mythical.
- **Altar** (nama tetap): taruh induk di slot kiri dan kanan; di tengah muncul siluet hitam monster yang mungkin didapat.
  - Gratis selama ada slot Altar kosong. Induk tidak lebur.
  - Pasangan dengan resep di daftar ini → hasil pasti.
  - Pasangan tanpa resep → monster acak tingkatan Common sampai Elite.
  - Ramalan Jiwa, mutasi dan pity tetap ada.
- **Boss** memberi hadiah acak: telur atau fragmen dari monster yang ditandai "Boss".
- **Waktu Altar per tingkatan hasil** (nanti masuk `rules.json`):

| Tingkatan | Waktu Altar | Poin kekuatan (Serbu) |
| --------- | ----------- | --------------------- |
| Common    | 10 menit    | 1                     |
| Uncommon  | 30 menit    | 2                     |
| Veteran   | 2 jam       | 3                     |
| Elite     | 6 jam       | 5                     |
| Rare      | 12 jam      | 8                     |
| Epic      | 24 jam      | 12                    |
| Legendary | 48 jam      | 18                    |
| Mythical  | 72 jam      | 25                    |

Common tidak punya resep; ia hanya bisa muncul dari Altar lewat hasil acak (pasangan tanpa resep), sehingga tetap butuh waktu 10 menit.

---

## Tier 1 — Common (1–13)

| No  | Nama             | Bentuk                                                                                                                      | Elemen    | Cara mendapatkan             |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------- |
| 1   | Baby Slime       | Gumpalan jeli biru-kehijauan sebesar bola, dua mata bulat di dalam tubuh beningnya; meninggalkan jejak basah saat memantul. | Air       | Telur                        |
| 2   | Mud Goblin       | Goblin pendek berkulit cokelat lumpur, telinga lancip terkulai, memegang tongkat kayu bengkok.                              | Tanah     | Telur, Eksplorasi            |
| 3   | Forest Sprite    | Peri sekecil jari bersayap capung, rambut serbuk sari yang bercahaya hangat.                                                | Light     | Telur, Eksplorasi (hutan)    |
| 4   | Cave Rat         | Tikus abu-abu kurus bermata merah, ekor botak panjang, selalu muncul bergerombol.                                           | Normal    | Eksplorasi (gua)             |
| 5   | Thorn Beetle     | Kumbang hijau tua sebesar kepalan, cangkang ditumbuhi duri mawar kecil.                                                     | Nature    | Telur                        |
| 6   | Skeleton Peasant | Kerangka petani bertopi caping robek, sabit berkarat di tangan, tulang kekuningan.                                          | Dark      | Eksplorasi (kuburan tua)     |
| 7   | Tiny Kobold      | Kadal kecil berdiri dua kaki, sisik merah bata, membawa lentera berisi bara dan karung curian.                              | Magma     | Telur                        |
| 8   | Puffowl          | Burung hantu bulat seperti bola bulu, mata kuning raksasa; bulu tajam di dadanya bisa ditembakkan.                          | Angin     | Telur                        |
| 9   | Rockling         | Golem batu setinggi lutut, tubuh dari tiga bongkah kerikil, lumut kecil di kepala.                                          | Tanah     | Eksplorasi (tambang)         |
| 10  | Wild Boar        | Babi hutan cokelat berbulu kasar, taring melengkung, punggung bergaris hitam.                                               | Normal    | Telur                        |
| 11  | Hedgehog Knight  | Landak berhelm ember logam dan tombak kecil; durinya berdesis listrik statis.                                               | Lightning | Quest (tutorial pertarungan) |
| 12  | Pumpkin Imp      | Iblis mungil berkepala labu berukir seringai, tubuh ungu, melempar biji labu yang meletup api.                              | Api       | Telur, Event (panen)         |
| 13  | Rusty Squire     | Remaja calon ksatria, helm kebesaran, pedang tumpul berkarat dan perisai papan kayu.                                        | Normal    | Telur, Quest                 |

## Tier 2 — Uncommon (14–26)

| No  | Nama            | Bentuk                                                                                    | Elemen    | Cara mendapatkan                                              |
| --- | --------------- | ----------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------- |
| 14  | Goblin Archer   | Goblin hijau berjubah daun, busur pendek dari ranting, kantong anak panah berbulu burung. | Nature    | Altar: Mud Goblin + Thorn Beetle                              |
| 15  | Dire Wolf Pup   | Anak serigala bertubuh bongsor, bulu abu tebal, cakar kebesaran untuk ukurannya.          | Normal    | Telur, Altar: Cave Rat + Wild Boar                            |
| 16  | Harpy Scout     | Makhluk bertubuh burung berwajah perempuan, sayap cokelat belang, kalung bulu pengintai.  | Angin     | Eksplorasi (tebing)                                           |
| 17  | Bandit Knight   | Prajurit bayaran berzirah kulit tambal sulam, syal merah menutupi wajah, pedang lebar.    | Normal    | Boss, Quest                                                   |
| 18  | Swamp Lurker    | Makhluk rawa pipih berkulit licin, mata menonjol di atas kepala, tubuh ditutupi ganggang. | Air       | Altar: Baby Slime + Mud Goblin                                |
| 19  | Ember Fox       | Rubah jingga ramping, ujung ekor dan telinga menyala seperti bara.                        | Api       | Altar: Pumpkin Imp + Cave Rat                                 |
| 20  | Bone Hound      | Anjing kerangka dengan mata api hijau pucat dan kalung rantai putus.                      | Dark      | Altar: Skeleton Peasant + Cave Rat                            |
| 21  | Horned Toad     | Katak gemuk bertanduk tiga yang berpendar biru, lidah panjang lengket yang menyetrum.     | Lightning | Altar: Baby Slime + Hedgehog Knight                           |
| 22  | Iron Turtle     | Kura-kura bercangkang pelat besi berpaku keling, kepala kecil bermata sipit.              | Tanah     | Altar: Rockling + Hedgehog Knight                             |
| 23  | Plague Crow     | Gagak kurus berbulu kusam, kabut ungu pekat menetes dari paruhnya.                        | Void      | Eksplorasi (rawa mati)                                        |
| 24  | Frost Hare      | Kelinci putih bertelinga kristal es, napasnya beruap dingin.                              | Ice       | Telur                                                         |
| 25  | Orc Militia     | Orc muda berkulit hijau tua, kapak obsidian dan perisai kayu bulat beruap panas.          | Magma     | Altar: Tiny Kobold + Rusty Squire                             |
| 26  | Mimic Chestling | Peti harta kecil bergigi tajam di tutupnya, lidah merah menjulur, kaki kayu mungil.       | Arcane    | Achievement (buka 50 peti), Altar: Rusty Squire + Pumpkin Imp |

## Tier 3 — Veteran (27–39)

| No  | Nama               | Bentuk                                                                                          | Elemen    | Cara mendapatkan                                         |
| --- | ------------------ | ----------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------- |
| 27  | Orc Berserker      | Orc berotot penuh bekas luka, dua kapak bergerigi, mata menyala merah saat terluka.             | Magma     | Altar: Orc Militia + Bandit Knight                       |
| 28  | Werewolf           | Manusia serigala tegak berbulu kelabu gelap, cakar panjang, sisa kemeja sobek di bahu.          | Dark      | Event (malam purnama), Altar: Dire Wolf Pup + Bone Hound |
| 29  | Minotaur Brute     | Manusia berkepala banteng, tanduk patah sebelah, cincin besi di hidung, kapak kayu besar.       | Normal    | Altar: Iron Turtle + Wild Boar                           |
| 30  | Dark Elf Ranger    | Elf berkulit ungu kelam, jubah bertudung, busur panjang yang anak panahnya lenyap ke bayangan.  | Void      | Altar: Goblin Archer + Plague Crow                       |
| 31  | Ghoul Stalker      | Mayat hidup kurus membungkuk, kuku panjang hitam, hidung mengendus darah.                       | Dark      | Eksplorasi (kuburan tua)                                 |
| 32  | Basilisk Hatchling | Bayi kadal hijau bersisik zamrud, mahkota duri kecil, mata kuning yang membuat lawan melambat.  | Nature    | Altar: Horned Toad + Thorn Beetle                        |
| 33  | Centaur Lancer     | Setengah manusia setengah kuda belang, zirah kulit, tombak panjang berpanji.                    | Angin     | Altar: Harpy Scout + Bandit Knight                       |
| 34  | War Boar Rider     | Orc kecil menunggangi babi perang berzirah, tombak pendek dan bendera compang-camping.          | Normal    | Altar: Orc Militia + Wild Boar                           |
| 35  | Gargoyle Sentinel  | Patung batu bersayap kelelawar, wajah garang, retak-retak berlumut di sayap.                    | Tanah     | Altar: Rockling + Mimic Chestling                        |
| 36  | Wisp Witch         | Roh perempuan bertubuh cahaya kebiruan, topi penyihir melayang, jemari memancarkan bola energi. | Light     | Altar: Forest Sprite + Plague Crow                       |
| 37  | Mummy Guard        | Penjaga makam berbalut perban kuning tua, tombak bermata sabit, mata hijau bercahaya.           | Arcane    | Eksplorasi (gurun)                                       |
| 38  | Thunder Ram        | Domba jantan berbulu awan kelabu, tanduk spiral memercikkan kilat.                              | Lightning | Altar: Horned Toad + Wild Boar                           |
| 39  | Knight of Ash      | Ksatria berzirah abu-abu hangus, jubah terbakar di ujung, pedang beruap.                        | Api       | Altar: Rusty Squire + Ember Fox                          |

## Tier 4 — Elite (40–52)

| No  | Nama              | Bentuk                                                                                    | Elemen    | Cara mendapatkan                       |
| --- | ----------------- | ----------------------------------------------------------------------------------------- | --------- | -------------------------------------- |
| 40  | Minotaur Warlord  | Minotaur raksasa berzirah perunggu, jubah merah, kapak bermata ganda sebesar pintu.       | Tanah     | Altar: Minotaur Brute + Orc Berserker  |
| 41  | Griffin           | Tubuh singa cokelat-emas, kepala dan sayap elang, cakar depan elang yang tajam.           | Angin     | Altar: Centaur Lancer + Harpy Scout    |
| 42  | Cyclops Brute     | Raksasa bermata satu, kulit kemerahan seperti tembaga panas, palu tempa besar.            | Magma     | Boss                                   |
| 43  | Death Knight      | Ksatria mayat hidup berzirah hitam berduri, pedang kutukan berpendar ungu.                | Dark      | Altar: Knight of Ash + Ghoul Stalker   |
| 44  | Troll Shaman      | Troll hijau bungkuk berhiaskan tulang dan bulu, tongkat akar yang menumbuhkan sulur.      | Nature    | Altar: Basilisk Hatchling + Wisp Witch |
| 45  | Manticorespawn    | Singa merah muda bersurai api, sayap kelelawar kecil, ekor kalajengking berduri.          | Api       | Altar: Ember Fox + Basilisk Hatchling  |
| 46  | War Golem         | Golem besi setinggi rumah, inti listrik biru di dada, tinju seperti godam.                | Lightning | Altar: Iron Turtle + Thunder Ram       |
| 47  | Valkyrie Initiate | Prajurit perempuan muda bersayap putih kecil, helm bersayap, tombak bercahaya.            | Light     | Altar: Wisp Witch + Centaur Lancer     |
| 48  | Chimera           | Singa berkepala tambahan kambing di punggung dan ekor ular yang mendesis.                 | Normal    | Altar: Werewolf + Basilisk Hatchling   |
| 49  | Headless Rider    | Penunggang tanpa kepala di atas kuda hitam berapi biru, membawa lentera tengkorak.        | Void      | Altar: Ghoul Stalker + War Boar Rider  |
| 50  | Frost Ogre        | Ogre biru pucat berjanggut es, pentungan bongkahan gletser, embun beku di setiap langkah. | Ice       | Altar: Frost Hare + Minotaur Brute     |
| 51  | Rune Knight       | Ksatria berzirah perak berukir rune biru menyala, perisai sihir melayang di depannya.     | Arcane    | Altar: Mummy Guard + Rusty Squire      |
| 52  | Shadow Panther    | Macan kumbang hitam, tubuhnya berasap bayangan, mata ungu menyala.                        | Dark      | Altar: Dark Elf Ranger + Ghoul Stalker |

## Tier 5 — Rare (53–64)

| No  | Nama             | Bentuk                                                                                                 | Elemen    | Cara mendapatkan                       |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------ | --------- | -------------------------------------- |
| 53  | Wyvern           | Naga berkaki dua bersisik merah tua, sayap selaput lebar, ekor berujung duri.                          | Api       | Altar: Manticorespawn + Griffin        |
| 54  | Cerberus         | Anjing raksasa berkepala tiga, bulu hitam berasap, retakan lava di sela cakar.                         | Magma     | Altar: Werewolf + Manticorespawn       |
| 55  | Medusa           | Perempuan berekor ular hijau, rambut ular-ular hidup, perisai perunggu dan mata bercahaya.             | Tanah     | Altar: Troll Shaman + Chimera          |
| 56  | Lich Acolyte     | Penyihir kerangka berjubah ungu lusuh, tongkat tengkorak, buku kematian melayang.                      | Arcane    | Altar: Death Knight + Rune Knight      |
| 57  | Roc              | Burung raksasa berbulu cokelat keemasan, cakar sebesar kereta, kepakannya membuat badai debu.          | Angin     | Boss                                   |
| 58  | Oni Warrior      | Iblis bertanduk dua berkulit merah, rambut putih liar, gada besi berpaku.                              | Normal    | Boss                                   |
| 59  | Kelpie           | Kuda air biru-hijau, surai rumput laut menetes, kuku berbentuk sirip.                                  | Air       | Altar: Centaur Lancer + Swamp Lurker   |
| 60  | Silverback Troll | Troll pegunungan besar berbulu perak, kulit sekeras batu, napas berembun dingin.                       | Ice       | Altar: Troll Shaman + Frost Ogre       |
| 61  | Ironclad Paladin | Ksatria suci berzirah putih tebal, palu bercahaya, aura emas melindungi kawan.                         | Light     | Altar: Valkyrie Initiate + War Golem   |
| 62  | Banshee          | Roh perempuan pucat tembus pandang, rambut panjang berkibar, mulut terbuka menjerit.                   | Dark      | Altar: Headless Rider + Wisp Witch     |
| 63  | Thunder Roc      | Burung raksasa berbulu hitam-biru, petir menjalar di sayap, mata putih menyala.                        | Lightning | Altar: Griffin + Thunder Ram           |
| 64  | Voidfang Stalker | Pemburu berkaki empat ramping bertaring panjang; tubuh berlubang hampa yang membuka celah teleportasi. | Void      | Altar: Shadow Panther + Headless Rider |

## Tier 6 — Epic (65–76)

| No  | Nama                  | Bentuk                                                                                           | Elemen    | Cara mendapatkan                                                     |
| --- | --------------------- | ------------------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------- |
| 65  | Hydra                 | Naga rawa berkepala lima, sisik hijau-biru basah, kepala yang terpotong tumbuh lagi.             | Air       | Altar: Medusa + Kelpie                                               |
| 66  | Fenrir                | Serigala raksasa berbulu putih-kelabu, rantai putus di leher, napas beku.                        | Ice       | Altar: Cerberus + Silverback Troll                                   |
| 67  | Behemoth              | Binatang kolosal mirip badak-gajah, kulit seperti batu karang, tanduk yang meruntuhkan tembok.   | Tanah     | Boss                                                                 |
| 68  | Djinn Warlord         | Jin bertubuh asap jingga dari pinggang ke bawah, sorban emas, pedang lengkung dan pusaran pasir. | Angin     | Altar: Roc + Lich Acolyte                                            |
| 69  | Dullahan Reaper       | Ksatria tanpa kepala berjubah compang-camping, kepala bercahaya dikepit, sabit panjang.          | Void      | Altar: Voidfang Stalker + Banshee                                    |
| 70  | Elder Treant          | Pohon purba berjalan, wajah di batang, janggut lumut, ranting seperti lengan raksasa.            | Nature    | Altar: Silverback Troll + Medusa                                     |
| 71  | Kraken Spawn          | Gurita besar ungu tua, tentakel penuh pengisap bercahaya, mata kuning bulat.                     | Air       | Boss                                                                 |
| 72  | Frost Dragon          | Naga bersisik biru es, sayap seperti lembaran kristal, duri es di punggung.                      | Ice       | Altar: Wyvern + Silverback Troll                                     |
| 73  | Salamander Lord       | Kadal raksasa berkulit lava retak, mahkota tanduk obsidian, jejak lahar di belakangnya.          | Magma     | Altar: Wyvern + Cerberus                                             |
| 74  | Arachne Matriarch     | Ratu laba-laba bertubuh atas perempuan, delapan kaki hitam berbulu, mahkota jaring perak.        | Dark      | Altar: Banshee + Medusa                                              |
| 75  | Storm Colossus        | Raksasa dari awan badai dan batu melayang, kedua tangan memegang petir.                          | Lightning | Altar: Thunder Roc + Oni Warrior                                     |
| 76  | Soulforged Juggernaut | Golem logam hitam berlapis kristal jiwa yang menyala, langkahnya mengguncang tanah.              | Arcane    | Achievement (100 kali Altar), Altar: Ironclad Paladin + Lich Acolyte |

## Tier 7 — Legendary (77–88)

| No  | Nama                | Bentuk                                                                                             | Elemen    | Cara mendapatkan                                   |
| --- | ------------------- | -------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------- |
| 77  | Phoenix             | Burung api besar berbulu emas-merah, ekor api panjang, bangkit dari abunya sendiri.                | Api       | Event, Altar: Salamander Lord + Djinn Warlord      |
| 78  | Bahamut             | Naga agung bersisik perak-biru, sayap bertabur cahaya, napas energi murni.                         | Arcane    | Boss                                               |
| 79  | Jörmungandr         | Ular raksasa hijau gelap bercorak rune, taring meneteskan racun yang melelehkan batu.              | Nature    | Boss                                               |
| 80  | Quetzalcoatl        | Ular bersayap berbulu hijau-zamrud dan merah, mahkota bulu, angin berputar di sekitarnya.          | Angin     | Quest (cerita utama)                               |
| 81  | Kirin               | Makhluk bertanduk satu bertubuh rusa bersisik emas, surai seperti petir, kuku tak menyentuh tanah. | Lightning | Altar: Storm Colossus + Elder Treant               |
| 82  | Nemean Lion         | Singa raksasa berkulit keemasan sekeras batu, surai tebal seperti pasir gurun.                     | Tanah     | Achievement (menang 500 pertarungan)               |
| 83  | Sphinx Oracle       | Singa bersayap berwajah manusia bijak, mahkota bergaris biru-emas, mata yang memantulkan ilusi.    | Arcane    | Quest (teka-teki), Altar: Lich Acolyte + Griffin   |
| 84  | Archangel Commander | Panglima bersayap enam, zirah emas, pedang cahaya, lingkaran cahaya di belakang kepala.            | Light     | Event, Altar: Ironclad Paladin + Valkyrie Initiate |
| 85  | Leviathan           | Monster laut raksasa mirip paus bersisik, sirip seperti layar, gelombang mengikuti geraknya.       | Air       | Altar: Kraken Spawn + Hydra                        |
| 86  | Eclipse Dragon      | Naga hitam dengan cincin cahaya redup di dada, sayap yang menelan sinar di sekitarnya.             | Dark      | Altar: Dullahan Reaper + Frost Dragon              |
| 87  | Valkyrie Queen      | Ratu prajurit bersayap besar, mahkota bersayap, tombak cahaya dan jubah putih berkibar.            | Light     | Altar: Ironclad Paladin + Griffin                  |
| 88  | Soul Devourer       | Makhluk bertudung tanpa wajah, mulut bercahaya hampa di dada, menyerap roh musuh yang gugur.       | Void      | Altar: Dullahan Reaper + Arachne Matriarch         |

## Tier 8 — Mythical (89–100)

| No  | Nama               | Bentuk                                                                                                            | Elemen    | Cara mendapatkan                                                          |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------- |
| 89  | Tiamat             | Naga purba laut berkepala lima, tiap kepala bercorak warna berbeda, tubuh berombak seperti samudra.               | Air       | Boss                                                                      |
| 90  | Nightmaw the Black | Naga hitam kolosal bersisik obsidian, sayap menutupi langit, napas api hitam.                                     | Magma     | Boss                                                                      |
| 91  | Typhon             | Raksasa badai bertubuh atas manusia dan bawah ular-ular, sayap petir, mata seperti pusaran angin.                 | Angin     | Boss                                                                      |
| 92  | Cthulhu            | Entitas kosmik berkepala gurita, sayap selaput kecil, tubuh hijau gelap berkilau; bisikannya membingungkan lawan. | Void      | Event                                                                     |
| 93  | World Eater Wyrm   | Naga cacing raksasa sebesar pegunungan, mulut bulat bergigi berlapis, sisik batu.                                 | Tanah     | Altar: Behemoth + Jörmungandr                                             |
| 94  | Aetherion          | Naga kristal bening dengan inti bintang di dada, sayap prisma yang membelokkan ruang.                             | Arcane    | Altar: Bahamut + Sphinx Oracle                                            |
| 95  | Death Sovereign    | Raja kerangka bermahkota hitam di atas singgasana tulang melayang, jubah kabut, tongkat penguasa jiwa.            | Dark      | Altar: Eclipse Dragon + Soul Devourer                                     |
| 96  | Astral Behemoth    | Binatang kosmik bertubuh langit malam, rasi bintang di kulitnya, meteor kecil mengorbit tubuhnya.                 | Light     | Event                                                                     |
| 97  | Primordial Titan   | Titan purba dari es dan batu zaman awal, janggut gletser, langkahnya meretakkan tanah.                            | Ice       | Boss (fragmen)                                                            |
| 98  | Void Hydra Emperor | Hydra bermahkota dengan kepala yang tiap-tiapnya berpendar warna elemen berbeda, tubuh hampa berbintang.          | Void      | Altar: Hydra + Leviathan                                                  |
| 99  | Godslayer Knight   | Ksatria berzirah hitam bergaris emas, pedang raksasa yang menyambarkan petir, jubah robek.                        | Lightning | Quest (akhir cerita)                                                      |
| 100 | The First Chimera  | Makhluk puncak gabungan banyak spesies: kepala singa, naga dan elang, sayap kristal, ekor ular berbulu.           | Normal    | Achievement (temukan semua resep Altar), Altar: Sphinx Oracle + Leviathan |
