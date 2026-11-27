import type { ConversationScenario, LanguageCode, Unit } from '../types.js';

interface DailyLifePack {
  language: LanguageCode;
  // Casa, cozinha & mercado (dona de casa & família)
  kitchen: { text: string; reading?: string; phonetic: string };
  fridge: { text: string; reading?: string; phonetic: string };
  bread: { text: string; reading?: string; phonetic: string };
  rice: { text: string; reading?: string; phonetic: string };
  market: { text: string; reading?: string; phonetic: string };
  key: { text: string; reading?: string; phonetic: string };
  door: { text: string; reading?: string; phonetic: string };
  shower: { text: string; reading?: string; phonetic: string };
  bed: { text: string; reading?: string; phonetic: string };
  buyBreadSentence: {
    text: string;
    reading?: string;
    phonetic: string;
    tokens: string[];
    distractor: string;
    tipPt: string;
  };
  whereKeySentence: {
    text: string;
    reading?: string;
    phonetic: string;
    tipPt: string;
    variants: string[];
  };
  // Escola, criança & aluno
  backpack: { text: string; reading?: string; phonetic: string };
  notebook: { text: string; reading?: string; phonetic: string };
  pencil: { text: string; reading?: string; phonetic: string };
  teacher: { text: string; reading?: string; phonetic: string };
  playSentence: {
    text: string;
    reading?: string;
    phonetic: string;
    tokens: string[];
    distractor: string;
    tipPt: string;
  };
  schoolQuestion: {
    teacherLine: string;
    teacherReading?: string;
    teacherPt: string;
    answer: string;
    answerReading?: string;
    wrong1: string;
    wrong2: string;
    tipPt: string;
  };
  // Trabalho, transporte & rotina do trabalhador
  work: { text: string; reading?: string; phonetic: string };
  bus: { text: string; reading?: string; phonetic: string };
  phone: { text: string; reading?: string; phonetic: string };
  lunch: { text: string; reading?: string; phonetic: string };
  arrivingSentence: {
    text: string;
    reading?: string;
    phonetic: string;
    tokens: string[];
    distractor: string;
    tipPt: string;
  };
  goodWorkSentence: {
    text: string;
    reading?: string;
    phonetic: string;
    tipPt: string;
    variants: string[];
  };
  marketScenario: {
    roleName: string;
    openingLine: string;
    openingReading?: string;
    openingPt: string;
    hint1: { text: string; reading?: string; translationPt: string };
    hint2: { text: string; reading?: string; translationPt: string };
  };
}

const DAILY_LIFE_PACKS: Record<LanguageCode, DailyLifePack> = {
  ko: {
    language: 'ko',
    kitchen: { text: '부엌', reading: 'Bueok', phonetic: 'bu-ók' },
    fridge: { text: '냉장고', reading: 'Naengjanggo', phonetic: 'nêng-djan-gô' },
    bread: { text: '빵', reading: 'Ppang', phonetic: 'pâng' },
    rice: { text: '밥', reading: 'Bap', phonetic: 'báp' },
    market: { text: '시장', reading: 'Sijang', phonetic: 'shi-djâng' },
    key: { text: '열쇠', reading: 'Yeolsoe', phonetic: 'iól-suê' },
    door: { text: '문', reading: 'Mun', phonetic: 'mûn' },
    shower: { text: '샤워', reading: 'Syawo', phonetic: 'shá-uó' },
    bed: { text: '침대', reading: 'Chimdae', phonetic: 'tchim-dê' },
    buyBreadSentence: {
      text: '빵 하고 우유 주세요',
      reading: 'Ppang hago uyu juseyo',
      phonetic: 'pâng rá-gô u-iú dju-SÊ-iô',
      tokens: ['빵', '하고', '우유', '주세요'],
      distractor: '침대',
      tipPt: '"하고 (hago)" significa "e" para juntar coisas na lista do mercado: pão E leite!',
    },
    whereKeySentence: {
      text: '열쇠 어디 있어요?',
      reading: 'Yeolsoe eodi isseoyo?',
      phonetic: 'iól-suê ó-di i-SSÓ-iô?',
      tipPt: 'Fale "어디 있어요? (eodi isseoyo?)" depois de qualquer objeto de casa para perguntar "onde está?"!',
      variants: ['열쇠 어디 있어요', 'yeolsoe eodi isseoyo'],
    },
    backpack: { text: '가방', reading: 'Gabang', phonetic: 'ga-bâng' },
    notebook: { text: '공책', reading: 'Gongchaek', phonetic: 'gông-tchék' },
    pencil: { text: '연필', reading: 'Yeonpil', phonetic: 'ión-pil' },
    teacher: { text: '선생님', reading: 'Seonsaengnim', phonetic: 'són-sêng-nim' },
    playSentence: {
      text: '같이 놀아요!',
      reading: 'Gachi norayo!',
      phonetic: 'ga-TCHI no-rá-iô!',
      tokens: ['같이', '놀아요!'],
      distractor: '공책',
      tipPt: '"같이 (gachi)" = juntos! "같이 놀아요!" é a frase perfeita do recreio para chamar amigos para brincar!',
    },
    schoolQuestion: {
      teacherLine: '질문 있어요?',
      teacherReading: 'Jilmun isseoyo?',
      teacherPt: 'Tem alguma pergunta?',
      answer: '화장실에 가도 돼요?',
      answerReading: 'Hwajangsil-e gado dwaeyo?',
      wrong1: '빵 주세요.',
      wrong2: '버스 있어요.',
      tipPt: '"화장실에 가도 돼요?" = "Posso ir ao banheiro?" — frase campeã na escola!',
    },
    work: { text: '일', reading: 'Il', phonetic: 'il' },
    bus: { text: '버스', reading: 'Beoseu', phonetic: 'bó-ssû' },
    phone: { text: '핸드폰', reading: 'Haendeupon', phonetic: 'rên-dû-pôn' },
    lunch: { text: '점심', reading: 'Jeomsim', phonetic: 'djóm-shim' },
    arrivingSentence: {
      text: '지금 가고 있어요',
      reading: 'Jigeum gago isseoyo',
      phonetic: 'dji-gûm ga-gô i-SSÓ-iô',
      tokens: ['지금', '가고', '있어요'],
      distractor: '버스',
      tipPt: '"지금 (jigeum)" = agora · "가고 있어요" = estou indo / chegando! Você usa todo dia no WhatsApp!',
    },
    goodWorkSentence: {
      text: '수고하셨습니다!',
      reading: 'Sugohasyeosseumnida!',
      phonetic: 'su-gô-ra-shó-ssûm-ni-DÁ!',
      tipPt: 'Na Coreia todo trabalhador diz "수고하셨습니다" no fim do expediente para agradecer pelo bom trabalho!',
      variants: ['수고하셨습니다', '수고했어요', 'sugohasyeosseumnida', 'sugohaesseoyo'],
    },
    marketScenario: {
      roleName: 'Sra. Park',
      openingLine: '어서 오세요! 오늘 뭐 사실 거예요?',
      openingReading: 'Eoseo oseyo! Oneul mwo sasil geoyeyo?',
      openingPt: 'Bem-vindo! O que você vai comprar hoje no mercado?',
      hint1: { text: '빵 하고 우유 주세요.', reading: 'Ppang hago uyu juseyo.', translationPt: 'Pão e leite, por favor.' },
      hint2: { text: '사과 얼마예요?', reading: 'Sagwa eolmayeyo?', translationPt: 'Quanto custa a maçã?' },
    },
  },

  en: {
    language: 'en',
    kitchen: { text: 'Kitchen', phonetic: 'KÍ-tchen' },
    fridge: { text: 'Fridge', phonetic: 'FRÍDJ' },
    bread: { text: 'Bread', phonetic: 'BRÉD' },
    rice: { text: 'Rice', phonetic: 'RÁIS' },
    market: { text: 'Supermarket', phonetic: 'SÚ-per-már-ket' },
    key: { text: 'Key', phonetic: 'KÍ' },
    door: { text: 'Door', phonetic: 'DÓR' },
    shower: { text: 'Shower', phonetic: 'SHÁU-er' },
    bed: { text: 'Bed', phonetic: 'BÉD' },
    buyBreadSentence: {
      text: 'I need to buy bread and milk.',
      phonetic: 'Ai níd tu bái bréd énd mílk.',
      tokens: ['I', 'need', 'to', 'buy', 'bread', 'and', 'milk.'],
      distractor: 'door',
      tipPt: 'Toda vez que for ao mercado, pense em inglês: "I need to buy..." (Eu preciso comprar...) — fixa na memória rapidinho!',
    },
    whereKeySentence: {
      text: 'Where are my keys?',
      phonetic: 'UÉR ár mai KÍZ?',
      tipPt: 'Frase que toda família fala todo dia em casa! Use "Where is...?" para 1 coisa e "Where are...?" para várias.',
      variants: ['where are my keys', 'where is my key'],
    },
    backpack: { text: 'Backpack', phonetic: 'BÉK-pék' },
    notebook: { text: 'Notebook', phonetic: 'NÔUT-bûk' },
    pencil: { text: 'Pencil', phonetic: 'PÊN-sol' },
    teacher: { text: 'Teacher', phonetic: 'TÍ-tcher' },
    playSentence: {
      text: "Let's play together!",
      phonetic: 'Léts plêi tu-GUÉ-dher!',
      tokens: ["Let's", 'play', 'together!'],
      distractor: 'pencil',
      tipPt: '"Let’s..." significa "Vamos..." — super útil para crianças chamarem amigos para brincar ou estudar!',
    },
    schoolQuestion: {
      teacherLine: 'Do you need anything before we start class?',
      teacherPt: 'Você precisa de alguma coisa antes da aula começar?',
      answer: 'Can I drink some water, please?',
      wrong1: 'I am a backpack.',
      wrong2: 'Where is the supermarket?',
      tipPt: '"Can I... please?" é a fórmula mágica da sala de aula para pedir água ou ir ao banheiro com educação!',
    },
    work: { text: 'Work', phonetic: 'UÔRK' },
    bus: { text: 'Bus', phonetic: 'BÂS' },
    phone: { text: 'Phone', phonetic: 'FÔUN' },
    lunch: { text: 'Lunch', phonetic: 'LÂNTCH' },
    arrivingSentence: {
      text: "I'm on my way to work.",
      phonetic: 'Aim ón mai uêi tu UÔRK.',
      tokens: ["I'm", 'on', 'my', 'way', 'to', 'work.'],
      distractor: 'bed',
      tipPt: '"On my way" = "Estou a caminho / chegando!" — uma das frases mais usadas no trabalho e na família!',
    },
    goodWorkSentence: {
      text: 'Time for a lunch break!',
      phonetic: 'Táim fór a lântch brêik!',
      tipPt: '"Lunch" é ALMOÇO (não lanche! Lanche em inglês é "snack")! Diga isso todo dia na hora do almoço para nunca mais confundir.',
      variants: ['time for a lunch break', 'its time for lunch'],
    },
    marketScenario: {
      roleName: 'Hannah',
      openingLine: 'Hi! Welcome to the neighborhood market. Are you looking for anything specific today?',
      openingPt: 'Oi! Bem-vindo ao mercado do bairro. Você está procurando algo específico hoje?',
      hint1: { text: 'Hi! I need to buy bread, milk and apples.', translationPt: 'Oi! Preciso comprar pão, leite e maçãs.' },
      hint2: { text: 'Where can I find rice, please?', translationPt: 'Onde eu encontro arroz, por favor?' },
    },
  },

  es: {
    language: 'es',
    kitchen: { text: 'Cocina', phonetic: 'ko-SÍ-na' },
    fridge: { text: 'Nevera', phonetic: 'ne-VÊ-ra' },
    bread: { text: 'Pan', phonetic: 'pân' },
    rice: { text: 'Arroz', phonetic: 'a-RRÓS' },
    market: { text: 'Supermercado', phonetic: 'su-per-mer-KÁ-do' },
    key: { text: 'Llave', phonetic: 'IÁ-ve' },
    door: { text: 'Puerta', phonetic: 'PUÉR-ta' },
    shower: { text: 'Ducha', phonetic: 'DÚ-tcha' },
    bed: { text: 'Cama', phonetic: 'KÁ-ma' },
    buyBreadSentence: {
      text: 'Necesito comprar pan y leche.',
      phonetic: 'Ne-se-SÍ-to kom-PRÁR pân i LÊ-tche.',
      tokens: ['Necesito', 'comprar', 'pan', 'y', 'leche.'],
      distractor: 'cama',
      tipPt: '"Leche" = leite e "pan" = pão! Olhe sua cozinha e repita os nomes em voz alta todo dia.',
    },
    whereKeySentence: {
      text: '¿Dónde están mis llaves?',
      phonetic: 'DÔN-de es-TÂN mis IÁ-ves?',
      tipPt: 'Em espanhol "LL" em "llaves" (chaves) soa parecido com "iá" ou "djá"!',
      variants: ['donde estan mis llaves', 'donde esta mi llave'],
    },
    backpack: { text: 'Mochila', phonetic: 'mo-TCHÍ-la' },
    notebook: { text: 'Cuaderno', phonetic: 'kua-DÉR-no' },
    pencil: { text: 'Lápiz', phonetic: 'LÁ-pis' },
    teacher: { text: 'Maestra', phonetic: 'ma-ÊS-tra' },
    playSentence: {
      text: '¡Vamos a jugar juntos!',
      phonetic: 'VÁ-mos a rru-GÁR RRÚN-tos!',
      tokens: ['¡Vamos', 'a', 'jugar', 'juntos!'],
      distractor: 'lápiz',
      tipPt: 'Em espanhol, "jugar" significa BRINCAR ou JOGAR — toda criança usa no recreio!',
    },
    schoolQuestion: {
      teacherLine: '¿Todo listo para empezar la clase?',
      teacherPt: 'Tudo pronto para começar a aula?',
      answer: '¿Puedo tomar agua, por favor?',
      wrong1: 'Necesito una cama.',
      wrong2: 'La puerta es azul.',
      tipPt: '"¿Puedo...?" = "Posso...?" — super educado para a escola!',
    },
    work: { text: 'Trabajo', phonetic: 'tra-BÁ-rro' },
    bus: { text: 'Autobús', phonetic: 'au-to-BÚS' },
    phone: { text: 'Celular', phonetic: 'se-lu-LÁR' },
    lunch: { text: 'Almuerzo', phonetic: 'al-MUÉR-so' },
    arrivingSentence: {
      text: 'Ya estoy llegando al trabajo.',
      phonetic: 'Iá es-TÔI ie-GÂN-do al tra-BÁ-rro.',
      tokens: ['Ya', 'estoy', 'llegando', 'al', 'trabajo.'],
      distractor: 'ducha',
      tipPt: 'Frase do dia a dia de todo trabalhador: "Ya estoy llegando!" (Já estou chegando!).',
    },
    goodWorkSentence: {
      text: '¡Buen trabajo hoy!',
      phonetic: 'Buên tra-BÁ-rro ôi!',
      tipPt: 'O H em "hoy" (hoje) é mudo! Use "¡Buen trabajo!" para elogiar colegas ou crianças.',
      variants: ['buen trabajo hoy', 'buen trabajo'],
    },
    marketScenario: {
      roleName: 'Doña Rosa',
      openingLine: '¡Hola! ¿Qué va a llevar hoy para la casa?',
      openingPt: 'Olá! O que você vai levar hoje para casa?',
      hint1: { text: 'Necesito comprar pan, leche y arroz.', translationPt: 'Preciso comprar pão, leite e arroz.' },
      hint2: { text: '¿Cuánto cuesta todo?', translationPt: 'Quanto custa tudo?' },
    },
  },

  ja: {
    language: 'ja',
    kitchen: { text: 'キッチン', reading: 'Kitchin', phonetic: 'KÍ-tchin' },
    fridge: { text: 'れいぞうこ', reading: 'Reizouko', phonetic: 'rêi-ZÔU-kô' },
    bread: { text: 'パン', reading: 'Pan', phonetic: 'PÂN' },
    rice: { text: 'ごはん', reading: 'Gohan', phonetic: 'gô-RÂN' },
    market: { text: 'スーパー', reading: 'Suupaa', phonetic: 'SÚ-paa' },
    key: { text: 'かぎ', reading: 'Kagi', phonetic: 'ká-gui' },
    door: { text: 'ドア', reading: 'Doa', phonetic: 'DÔ-a' },
    shower: { text: 'シャワー', reading: 'Shawaa', phonetic: 'SHÁ-uaa' },
    bed: { text: 'ベッド', reading: 'Beddo', phonetic: 'BÉ-ddô' },
    buyBreadSentence: {
      text: 'パン を かいます',
      reading: 'Pan o kaimasu',
      phonetic: 'pân ô kai-MÁS',
      tokens: ['パン', 'を', 'かいます'],
      distractor: 'ドア',
      tipPt: 'Curiosidade legal: "パン (Pan = pão)" veio do português quando os navegadores chegaram ao Japão!',
    },
    whereKeySentence: {
      text: 'かぎ は どこ です か？',
      reading: 'Kagi wa doko desu ka?',
      phonetic: 'ká-gui uá DÔ-kô dés ká?',
      tipPt: 'Use "...wa doko desu ka?" para perguntar onde está qualquer coisa em casa!',
      variants: ['かぎはどこですか', 'kagi wa doko desu ka'],
    },
    backpack: { text: 'リュック', reading: 'Ryukku', phonetic: 'RIÚ-kku' },
    notebook: { text: 'ノート', reading: 'Nooto', phonetic: 'NÔO-to' },
    pencil: { text: 'えんぴつ', reading: 'Enpitsu', phonetic: 'ên-PÍ-tsu' },
    teacher: { text: 'せんせい', reading: 'Sensei', phonetic: 'sên-SÊI' },
    playSentence: {
      text: 'いっしょ に あそぼう！',
      reading: 'Issho ni asobou!',
      phonetic: 'i-SSHÔ ni a-so-BÔU!',
      tokens: ['いっしょ', 'に', 'あそぼう！'],
      distractor: 'ノート',
      tipPt: '"Issho ni asobou!" = "Vamos brincar juntos!" — super usado por crianças no Japão!',
    },
    schoolQuestion: {
      teacherLine: 'だいじょうぶ ですか？',
      teacherReading: 'Daijoubu desu ka?',
      teacherPt: 'Está tudo bem?',
      answer: 'はい、せんせい！',
      answerReading: 'Hai, sensei!',
      wrong1: 'パン を ください。',
      wrong2: 'ベッド です。',
      tipPt: '"はい (Hai)" = Sim · "せんせい (Sensei)" = Professor(a)!',
    },
    work: { text: 'しごと', reading: 'Shigoto', phonetic: 'shi-GÔ-to' },
    bus: { text: 'バス', reading: 'Basu', phonetic: 'BÁ-su' },
    phone: { text: 'スマホ', reading: 'Sumaho', phonetic: 'su-MÁ-rô' },
    lunch: { text: 'ひるごはん', reading: 'Hirugohan', phonetic: 'ri-ru-GÔ-rân' },
    arrivingSentence: {
      text: 'いま いきます',
      reading: 'Ima ikimasu',
      phonetic: 'í-ma i-ki-MÁS',
      tokens: ['いま', 'いきます'],
      distractor: 'バス',
      tipPt: '"いま (ima)" = agora · "いきます (ikimasu)" = estou indo!',
    },
    goodWorkSentence: {
      text: 'おつかれさま です！',
      reading: 'Otsukaresama desu!',
      phonetic: 'ô-tsu-ka-re-SA-ma dés!',
      tipPt: 'Expressão clássica do trabalhador japonês: "Bom trabalho / obrigado pelo esforço hoje!"',
      variants: ['おつかれさまです', 'otsukaresama desu'],
    },
    marketScenario: {
      roleName: 'Yuki',
      openingLine: 'いらっしゃいませ！きょう は なに を かいます か？',
      openingReading: 'Irasshaimase! Kyou wa nani o kaimasu ka?',
      openingPt: 'Bem-vindo! O que você vai comprar hoje?',
      hint1: { text: 'パン と みず を ください。', reading: 'Pan to mizu o kudasai.', translationPt: 'Pão e água, por favor.' },
      hint2: { text: 'ごはん は どこ です か？', reading: 'Gohan wa doko desu ka?', translationPt: 'Onde fica o arroz?' },
    },
  },

  fr: {
    language: 'fr',
    kitchen: { text: 'Cuisine', phonetic: 'küi-ZÍN' },
    fridge: { text: 'Frigo', phonetic: 'fri-GÔ' },
    bread: { text: 'Pain', phonetic: 'PÃN' },
    rice: { text: 'Riz', phonetic: 'RÍ' },
    market: { text: 'Marché', phonetic: 'mar-SHÊ' },
    key: { text: 'Clé', phonetic: 'KLÊ' },
    door: { text: 'Porte', phonetic: 'PÓRT' },
    shower: { text: 'Douche', phonetic: 'DÚSH' },
    bed: { text: 'Lit', phonetic: 'LÍ' },
    buyBreadSentence: {
      text: 'Je vais acheter du pain.',
      phonetic: 'Jê vé ash-TÊ dü PÃN.',
      tokens: ['Je', 'vais', 'acheter', 'du', 'pain.'],
      distractor: 'porte',
      tipPt: 'Fale "Je vais acheter du pain" sempre que sair para a padaria — grava na hora!',
    },
    whereKeySentence: {
      text: 'Où est la clé ?',
      phonetic: 'Ú é la KLÊ?',
      tipPt: '"Où est...?" (Onde está...?) funciona para qualquer coisa perdida em casa!',
      variants: ['ou est la cle', 'ou sont les cles'],
    },
    backpack: { text: 'Sac à dos', phonetic: 'sák a DÔ' },
    notebook: { text: 'Cahier', phonetic: 'ka-IÊ' },
    pencil: { text: 'Crayon', phonetic: 'kré-IÕN' },
    teacher: { text: 'Professeur', phonetic: 'pro-fe-SÊR' },
    playSentence: {
      text: 'On joue ensemble !',
      phonetic: 'Õn jú ãn-SÃN-bl!',
      tokens: ['On', 'joue', 'ensemble', '!'],
      distractor: 'cahier',
      tipPt: '"On joue ensemble !" = "Vamos brincar juntos!" — jeito super natural das crianças francesas!',
    },
    schoolQuestion: {
      teacherLine: 'Tu as tout dans ton sac à dos ?',
      teacherPt: 'Você colocou tudo na sua mochila?',
      answer: "Oui, j'ai mon cahier et mon crayon.",
      wrong1: 'Je vais à la douche.',
      wrong2: 'Où est le frigo ?',
      tipPt: '"J’ai..." = "Eu tenho / estou com..."!',
    },
    work: { text: 'Travail', phonetic: 'tra-VÁI' },
    bus: { text: 'Bus', phonetic: 'BÜS' },
    phone: { text: 'Téléphone', phonetic: 'tê-lê-FÓN' },
    lunch: { text: 'Déjeuner', phonetic: 'dê-jê-NÊ' },
    arrivingSentence: {
      text: "J'arrive au travail.",
      phonetic: 'Ja-RÍV ô tra-VÁI.',
      tokens: ["J'arrive", 'au', 'travail.'],
      distractor: 'lit',
      tipPt: '"J’arrive !" = "Estou chegando!" — frase que os franceses usam o dia inteiro!',
    },
    goodWorkSentence: {
      text: 'Bon courage pour le travail !',
      phonetic: 'Bôn ku-RÁJ pur lê tra-VÁI!',
      tipPt: '"Bon courage !" é o jeito carinhoso francês de desejar força e bom trabalho!',
      variants: ['bon courage pour le travail', 'bon courage'],
    },
    marketScenario: {
      roleName: 'Sophie',
      openingLine: "Bonjour ! Qu'est-ce qu'il vous faut pour la maison aujourd'hui ?",
      openingPt: 'Bom dia! Do que você precisa para casa hoje?',
      hint1: { text: "Je voudrais du pain et du lait, s'il vous plaît.", translationPt: 'Eu gostaria de pão e leite, por favor.' },
      hint2: { text: 'Où est le riz ?', translationPt: 'Onde fica o arroz?' },
    },
  },

  de: {
    language: 'de',
    kitchen: { text: 'Küche', phonetic: 'KÜ-rre' },
    fridge: { text: 'Kühlschrank', phonetic: 'KÜL-shrank' },
    bread: { text: 'Brot', phonetic: 'BRÔT' },
    rice: { text: 'Reis', phonetic: 'RÁIS' },
    market: { text: 'Supermarkt', phonetic: 'ZÚ-per-markt' },
    key: { text: 'Schlüssel', phonetic: 'SHLÜ-sel' },
    door: { text: 'Tür', phonetic: 'TÜR' },
    shower: { text: 'Dusche', phonetic: 'DÚ-she' },
    bed: { text: 'Bett', phonetic: 'BÉT' },
    buyBreadSentence: {
      text: 'Ich kaufe Brot und Milch.',
      phonetic: 'Írr KÁU-fe brôt unt MÍLrr.',
      tokens: ['Ich', 'kaufe', 'Brot', 'und', 'Milch.'],
      distractor: 'Bett',
      tipPt: 'Repare que em alemão todo substantivo (Brot, Milch) começa com letra maiúscula!',
    },
    whereKeySentence: {
      text: 'Wo ist der Schlüssel?',
      phonetic: 'Vô ist dér SHLÜ-sel?',
      tipPt: '"Wo ist...?" (Onde está...?) — lembre que W em alemão sempre tem som de V!',
      variants: ['wo ist der schlussel', 'wo ist mein schlussel'],
    },
    backpack: { text: 'Rucksack', phonetic: 'RÚK-zak' },
    notebook: { text: 'Heft', phonetic: 'RÉFT' },
    pencil: { text: 'Bleistift', phonetic: 'BLÁI-shtift' },
    teacher: { text: 'Lehrer', phonetic: 'LÊ-rer' },
    playSentence: {
      text: 'Wollen wir zusammen spielen?',
      phonetic: 'VÓ-len vir tsu-ZÁ-men SHPÍ-len?',
      tokens: ['Wollen', 'wir', 'zusammen', 'spielen?'],
      distractor: 'Heft',
      tipPt: '"Spielen" = brincar / jogar! "Zusammen" = juntos!',
    },
    schoolQuestion: {
      teacherLine: 'Hast du dein Heft dabei?',
      teacherPt: 'Você trouxe seu caderno?',
      answer: 'Ja, es ist in meinem Rucksack!',
      wrong1: 'Ich kaufe Brot.',
      wrong2: 'Wo ist die Dusche?',
      tipPt: '"Rucksack" = mochila (literalmente saco nas costas)!',
    },
    work: { text: 'Arbeit', phonetic: 'ÁR-bait' },
    bus: { text: 'Bus', phonetic: 'BÚS' },
    phone: { text: 'Handy', phonetic: 'RÊN-di' },
    lunch: { text: 'Mittagessen', phonetic: 'MÍ-tag-é-sen' },
    arrivingSentence: {
      text: 'Ich bin auf dem Weg zur Arbeit.',
      phonetic: 'Írr bin áuf dêm vêg tsur ÁR-bait.',
      tokens: ['Ich', 'bin', 'auf', 'dem', 'Weg', 'zur', 'Arbeit.'],
      distractor: 'Tür',
      tipPt: 'Curiosidade: celular na Alemanha se chama "Handy"!',
    },
    goodWorkSentence: {
      text: 'Gute Arbeit heute!',
      phonetic: 'GÚ-te ÁR-bait RÔI-te!',
      tipPt: '"Gute Arbeit!" = "Bom trabalho!" — simples e super positivo!',
      variants: ['gute arbeit heute', 'gute arbeit'],
    },
    marketScenario: {
      roleName: 'Anna',
      openingLine: 'Hallo! Was brauchen Sie heute für zu Hause?',
      openingPt: 'Olá! O que você precisa hoje para casa?',
      hint1: { text: 'Ich kaufe Brot, Milch und Äpfel.', translationPt: 'Estou comprando pão, leite e maçãs.' },
      hint2: { text: 'Wo finde ich Reis, bitte?', translationPt: 'Onde encontro arroz, por favor?' },
    },
  },

  it: {
    language: 'it',
    kitchen: { text: 'Cucina', phonetic: 'ku-TCHÍ-na' },
    fridge: { text: 'Frigo', phonetic: 'FRÍ-go' },
    bread: { text: 'Pane', phonetic: 'PÁ-ne' },
    rice: { text: 'Riso', phonetic: 'RÍ-zo' },
    market: { text: 'Mercato', phonetic: 'mer-KÁ-to' },
    key: { text: 'Chiave', phonetic: 'KIÁ-ve' },
    door: { text: 'Porta', phonetic: 'PÓR-ta' },
    shower: { text: 'Doccia', phonetic: 'DÓ-tcha' },
    bed: { text: 'Letto', phonetic: 'LÉ-tto' },
    buyBreadSentence: {
      text: 'Devo comprare pane e latte.',
      phonetic: 'DÊ-vo kom-PRÁ-re PÁ-ne e LÁ-tte.',
      tokens: ['Devo', 'comprare', 'pane', 'e', 'latte.'],
      distractor: 'letto',
      tipPt: 'Olha como é parecido com o português: "Devo comprare pane e latte" (Preciso comprar pão e leite)!',
    },
    whereKeySentence: {
      text: 'Dove sono le chiavi?',
      phonetic: 'DÔ-ve SÔ-no le KIÁ-vi?',
      tipPt: '"Chiave" (chave) tem som de KIÁ-ve porque "CHI" em italiano soa sempre KI!',
      variants: ['dove sono le chiavi', 'dove la chiave'],
    },
    backpack: { text: 'Zaino', phonetic: 'DZÁI-no' },
    notebook: { text: 'Quaderno', phonetic: 'kua-DÉR-no' },
    pencil: { text: 'Matita', phonetic: 'ma-TÍ-ta' },
    teacher: { text: 'Maestra', phonetic: 'ma-ÊS-tra' },
    playSentence: {
      text: 'Giochiamo insieme!',
      phonetic: 'Djo-KIÁ-mo in-SIÊ-me!',
      tokens: ['Giochiamo', 'insieme!'],
      distractor: 'matita',
      tipPt: '"Giochiamo insieme!" = "Vamos brincar juntos!" — música pura em italiano!',
    },
    schoolQuestion: {
      teacherLine: 'Avete portato il quaderno oggi?',
      teacherPt: 'Vocês trouxeram o caderno hoje?',
      answer: 'Sì, è dentro il mio zaino!',
      wrong1: 'Devo fare la doccia.',
      wrong2: 'Vorrei del pane.',
      tipPt: '"Zaino" = mochila! Super fácil de lembrar.',
    },
    work: { text: 'Lavoro', phonetic: 'la-VÔ-ro' },
    bus: { text: 'Autobus', phonetic: 'ÁU-to-bus' },
    phone: { text: 'Cellulare', phonetic: 'tche-lu-LÁ-re' },
    lunch: { text: 'Pranzo', phonetic: 'PRÂN-dzo' },
    arrivingSentence: {
      text: 'Sto arrivando al lavoro.',
      phonetic: 'Stó a-rri-VÂN-do al la-VÔ-ro.',
      tokens: ['Sto', 'arrivando', 'al', 'lavoro.'],
      distractor: 'porta',
      tipPt: '"Sto arrivando!" = "Estou chegando!" — perfeito para o dia a dia!',
    },
    goodWorkSentence: {
      text: 'Buon lavoro a tutti!',
      phonetic: 'Buôn la-VÔ-ro a TÚ-tti!',
      tipPt: 'Os italianos adoram desejar "Buon lavoro!" quando chegam no trabalho ou numa loja!',
      variants: ['buon lavoro a tutti', 'buon lavoro'],
    },
    marketScenario: {
      roleName: 'Marco',
      openingLine: 'Buongiorno! Cosa prende oggi al mercato?',
      openingPt: 'Bom dia! O que você vai levar hoje no mercado?',
      hint1: { text: 'Vorrei del pane fresco e del latte.', translationPt: 'Gostaria de pão fresco e leite.' },
      hint2: { text: 'Quanto costa il riso?', translationPt: 'Quanto custa o arroz?' },
    },
  },

  zh: {
    language: 'zh',
    kitchen: { text: '厨房', reading: 'Chúfáng', phonetic: 'tchu-FÂNG' },
    fridge: { text: '冰箱', reading: 'Bīngxiāng', phonetic: 'bing-SHIÂNG' },
    bread: { text: '面包', reading: 'Miànbāo', phonetic: 'miên-BÁO' },
    rice: { text: '米饭', reading: 'Mǐfàn', phonetic: 'mí-FÂN' },
    market: { text: '超市', reading: 'Chāoshì', phonetic: 'tcháu-SHÊ' },
    key: { text: '钥匙', reading: 'Yàoshi', phonetic: 'iáu-SHÊ' },
    door: { text: '门', reading: 'Mén', phonetic: 'MÊN' },
    shower: { text: '洗澡', reading: 'Xǐzǎo', phonetic: 'shi-DZÁU' },
    bed: { text: '床', reading: 'Chuáng', phonetic: 'tchu-ÂNG' },
    buyBreadSentence: {
      text: '我 要 买 面包',
      reading: 'Wǒ yào mǎi miànbāo',
      phonetic: 'uó iáu mái miên-BÁO',
      tokens: ['我', '要', '买', '面包'],
      distractor: '床',
      tipPt: '我 (eu) + 要 (quero) + 买 (comprar) + 面包 (pão)! Sem conjugação nenhuma!',
    },
    whereKeySentence: {
      text: '钥匙 在 哪里？',
      reading: 'Yàoshi zài nǎlǐ?',
      phonetic: 'iáu-shê dzái NÁ-lí?',
      tipPt: 'Coloque "在哪里？ (zài nǎlǐ?)" depois de qualquer objeto de casa para perguntar "onde está?"!',
      variants: ['钥匙在哪里', 'yaoshi zai nali'],
    },
    backpack: { text: '书包', reading: 'Shūbāo', phonetic: 'shú-BÁO' },
    notebook: { text: '本子', reading: 'Běnzi', phonetic: 'bên-DZÊ' },
    pencil: { text: '铅笔', reading: 'Qiānbǐ', phonetic: 'tchiên-BÍ' },
    teacher: { text: '老师', reading: 'Lǎoshī', phonetic: 'láu-SHÊ' },
    playSentence: {
      text: '我们 一起 玩 吧！',
      reading: 'Wǒmen yìqǐ wán ba!',
      phonetic: 'uó-mên í-tchí UÂN ba!',
      tokens: ['我们', '一起', '玩', '吧！'],
      distractor: '铅笔',
      tipPt: '"一起玩 (yìqǐ wán)" = brincar juntos! Super divertido para crianças!',
    },
    schoolQuestion: {
      teacherLine: '同学们，准备好了吗？',
      teacherReading: 'Tóngxuémen, zhǔnbèi hǎo le ma?',
      teacherPt: 'Alunos, estão prontos?',
      answer: '好了，老师！',
      answerReading: 'Hǎo le, lǎoshī!',
      wrong1: '我要买米饭。',
      wrong2: '冰箱在哪里？',
      tipPt: '"老师 (Lǎoshī)" = Professor(a)! "好了 (Hǎo le)" = Pronto!',
    },
    work: { text: '工作', reading: 'Gōngzuò', phonetic: 'gông-DZUÓ' },
    bus: { text: '公交车', reading: 'Gōngjiāochē', phonetic: 'gông-djiáu-TCHÊ' },
    phone: { text: '手机', reading: 'Shǒujī', phonetic: 'shôu-DJÍ' },
    lunch: { text: '午饭', reading: 'Wǔfàn', phonetic: 'ú-FÂN' },
    arrivingSentence: {
      text: '我 马上 到',
      reading: 'Wǒ mǎshàng dào',
      phonetic: 'uó má-shâng DÁU',
      tokens: ['我', '马上', '到'],
      distractor: '门',
      tipPt: '"我马上到 (Wǒ mǎshàng dào)" = "Estou chegando já!" — muito usado todo dia!',
    },
    goodWorkSentence: {
      text: '辛苦了！',
      reading: 'Xīnkǔ le!',
      phonetic: 'shin-KÚ la!',
      tipPt: 'Na China, "辛苦了!" é o elogio carinhoso do trabalhador: "Obrigado pelo seu esforço hoje!"',
      variants: ['辛苦了', 'xinku le'],
    },
    marketScenario: {
      roleName: 'Lin',
      openingLine: '你好！今天想买什么回家？',
      openingReading: 'Nǐ hǎo! Jīntiān xiǎng mǎi shénme huíjiā?',
      openingPt: 'Olá! O que você quer comprar para levar para casa hoje?',
      hint1: { text: '我要买面包和米饭。', reading: 'Wǒ yào mǎi miànbāo hé mǐfàn.', translationPt: 'Eu quero comprar pão e arroz.' },
      hint2: { text: '超市的牛奶在哪里？', reading: 'Chāoshì de niúnǎi zài nǎlǐ?', translationPt: 'Onde fica o leite no mercado?' },
    },
  },
};

export function buildDailyLifeUnits(lang: LanguageCode): {
  units: Unit[];
  scenarios: ConversationScenario[];
} {
  const p = DAILY_LIFE_PACKS[lang];

  const homeUnit: Unit = {
    id: `${lang}-u-home`,
    language: lang,
    order: 2,
    cefr: 'A1',
    titlePt: '🏠 Dia a Dia em Casa, Cozinha e Mercado',
    descriptionPt:
      'Palavras e frases que a família e a dona de casa usam todos os dias: cozinha, mercado, chave, banho e rotina!',
    culturalNotePt:
      'Dica de memória rápida: quando abrir a geladeira, comprar pão ou procurar a chave hoje, repita o nome em voz alta no novo idioma — assim você nunca mais esquece!',
    lessons: [
      {
        id: `${lang}-home-l1`,
        unitId: `${lang}-u-home`,
        order: 1,
        titlePt: 'Na Cozinha e no Mercado',
        subtitlePt: 'Cozinha, geladeira, pão, arroz e compras',
        durationMinutes: 4,
        xpReward: 45,
        cefr: 'A1',
        focusSkill: 'vocabulary',
        exercises: [
          {
            id: `${lang}-home-l1-e1`,
            type: 'picture_choice',
            skill: 'vocabulary',
            promptPt: 'Qual destes significa "Pão" (que compramos todo dia)?',
            targetText: p.bread.text,
            reading: p.bread.reading,
            ipaOrPhoneticBr: p.bread.phonetic,
            translationPt: 'Pão',
            brazilianTipPt: `Fale "${p.bread.text}" hoje na hora do café da manhã para gravar fácil!`,
            options: [
              { id: 'a', text: p.kitchen.text, reading: p.kitchen.reading, translationPt: 'Cozinha', emoji: '🍳' },
              { id: 'b', text: p.bread.text, reading: p.bread.reading, translationPt: 'Pão', emoji: '🍞' },
              { id: 'c', text: p.fridge.text, reading: p.fridge.reading, translationPt: 'Geladeira', emoji: '🧊' },
              { id: 'd', text: p.rice.text, reading: p.rice.reading, translationPt: 'Arroz', emoji: '🍚' },
            ],
            correctOptionId: 'b',
          },
          {
            id: `${lang}-home-l1-e2`,
            type: 'match_pairs',
            skill: 'vocabulary',
            promptPt: 'Ligue as coisas da cozinha e do mercado!',
            targetText: `${p.kitchen.text} / ${p.fridge.text} / ${p.rice.text} / ${p.market.text}`,
            translationPt: 'Cozinha / Geladeira / Arroz / Mercado',
            brazilianTipPt: 'Toque em cada palavra para ouvir o som e ligar com o que temos em casa!',
            pairs: [
              { id: 'p1', left: p.kitchen.text, leftReading: p.kitchen.reading, right: 'Cozinha', emoji: '🍳' },
              { id: 'p2', left: p.fridge.text, leftReading: p.fridge.reading, right: 'Geladeira', emoji: '🧊' },
              { id: 'p3', left: p.rice.text, leftReading: p.rice.reading, right: 'Arroz', emoji: '🍚' },
              { id: 'p4', left: p.market.text, leftReading: p.market.reading, right: 'Mercado', emoji: '🛒' },
            ],
          },
          {
            id: `${lang}-home-l1-e3`,
            type: 'listen_build',
            skill: 'listening',
            promptPt: 'Monte a frase de todo dia para comprar pão:',
            targetText: p.buyBreadSentence.text,
            reading: p.buyBreadSentence.reading,
            ipaOrPhoneticBr: p.buyBreadSentence.phonetic,
            translationPt: 'Comprar pão no dia a dia',
            brazilianTipPt: p.buyBreadSentence.tipPt,
            wordBank: [...p.buyBreadSentence.tokens, p.buyBreadSentence.distractor],
            correctTokens: p.buyBreadSentence.tokens,
          },
        ],
      },
      {
        id: `${lang}-home-l2`,
        unitId: `${lang}-u-home`,
        order: 2,
        titlePt: 'Rotina da Casa: Chave, Porta e Banho',
        subtitlePt: 'Coisas que toda família fala de manhã até a hora de dormir',
        durationMinutes: 4,
        xpReward: 45,
        cefr: 'A1',
        focusSkill: 'speaking',
        exercises: [
          {
            id: `${lang}-home-l2-e1`,
            type: 'picture_choice',
            skill: 'vocabulary',
            promptPt: 'Qual palavra significa "Chave" (que todo mundo procura antes de sair)?',
            targetText: p.key.text,
            reading: p.key.reading,
            ipaOrPhoneticBr: p.key.phonetic,
            translationPt: 'Chave',
            brazilianTipPt: `Quando pegar a chave de casa hoje, lembre: "${p.key.text}"!`,
            options: [
              { id: 'a', text: p.key.text, reading: p.key.reading, translationPt: 'Chave', emoji: '🔑' },
              { id: 'b', text: p.door.text, reading: p.door.reading, translationPt: 'Porta', emoji: '🚪' },
              { id: 'c', text: p.shower.text, reading: p.shower.reading, translationPt: 'Banho', emoji: '🚿' },
              { id: 'd', text: p.bed.text, reading: p.bed.reading, translationPt: 'Cama', emoji: '🛏️' },
            ],
            correctOptionId: 'a',
          },
          {
            id: `${lang}-home-l2-e2`,
            type: 'match_pairs',
            skill: 'vocabulary',
            promptPt: 'Ligue os objetos e momentos da casa!',
            targetText: `${p.key.text} / ${p.door.text} / ${p.shower.text} / ${p.bed.text}`,
            translationPt: 'Chave / Porta / Banho / Cama',
            brazilianTipPt: 'Palavras que a família inteira vive todos os dias!',
            pairs: [
              { id: 'p1', left: p.key.text, leftReading: p.key.reading, right: 'Chave', emoji: '🔑' },
              { id: 'p2', left: p.door.text, leftReading: p.door.reading, right: 'Porta', emoji: '🚪' },
              { id: 'p3', left: p.shower.text, leftReading: p.shower.reading, right: 'Banho', emoji: '🚿' },
              { id: 'p4', left: p.bed.text, leftReading: p.bed.reading, right: 'Cama', emoji: '🛏️' },
            ],
          },
          {
            id: `${lang}-home-l2-e3`,
            type: 'speak_pronounce',
            skill: 'speaking',
            promptPt: 'Treine perguntar em voz alta "Onde está a chave?":',
            targetText: p.whereKeySentence.text,
            reading: p.whereKeySentence.reading,
            ipaOrPhoneticBr: p.whereKeySentence.phonetic,
            translationPt: 'Onde está a chave?',
            brazilianTipPt: p.whereKeySentence.tipPt,
            acceptedSpeechVariants: p.whereKeySentence.variants,
          },
        ],
      },
    ],
  };

  const schoolWorkUnit: Unit = {
    id: `${lang}-u-school-work`,
    language: lang,
    order: 3,
    cefr: 'A1',
    titlePt: '🎒 Escola, Criança e Trabalho de Todo Dia',
    descriptionPt:
      'A rotina do aluno na escola (mochila, caderno, recreio) e do trabalhador (ônibus, celular, almoço e expediente)!',
    culturalNotePt:
      'Estudar situações reais da mochila da escola e do caminho do trabalho faz a criança e o adulto usarem o idioma na mesma hora!',
    lessons: [
      {
        id: `${lang}-school-l1`,
        unitId: `${lang}-u-school-work`,
        order: 1,
        titlePt: 'Escola, Mochila e Recreio (Aluno & Criança)',
        subtitlePt: 'Mochila, caderno, lápis, professor e brincar juntos',
        durationMinutes: 4,
        xpReward: 50,
        cefr: 'A1',
        focusSkill: 'vocabulary',
        exercises: [
          {
            id: `${lang}-school-l1-e1`,
            type: 'picture_choice',
            skill: 'vocabulary',
            promptPt: 'Qual destes é a "Mochila" que levamos para a escola?',
            targetText: p.backpack.text,
            reading: p.backpack.reading,
            ipaOrPhoneticBr: p.backpack.phonetic,
            translationPt: 'Mochila',
            brazilianTipPt: `Quando arrumar a mochila da escola, diga "${p.backpack.text}"!`,
            options: [
              { id: 'a', text: p.notebook.text, reading: p.notebook.reading, translationPt: 'Caderno', emoji: '📓' },
              { id: 'b', text: p.pencil.text, reading: p.pencil.reading, translationPt: 'Lápis', emoji: '✏️' },
              { id: 'c', text: p.backpack.text, reading: p.backpack.reading, translationPt: 'Mochila', emoji: '🎒' },
              { id: 'd', text: p.teacher.text, reading: p.teacher.reading, translationPt: 'Professor(a)', emoji: '👩‍🏫' },
            ],
            correctOptionId: 'c',
          },
          {
            id: `${lang}-school-l1-e2`,
            type: 'match_pairs',
            skill: 'vocabulary',
            promptPt: 'Ligue os materiais da escola!',
            targetText: `${p.backpack.text} / ${p.notebook.text} / ${p.pencil.text} / ${p.teacher.text}`,
            translationPt: 'Mochila / Caderno / Lápis / Professor(a)',
            brazilianTipPt: 'Tudo o que o aluno vê todo dia na sala de aula!',
            pairs: [
              { id: 'p1', left: p.backpack.text, leftReading: p.backpack.reading, right: 'Mochila', emoji: '🎒' },
              { id: 'p2', left: p.notebook.text, leftReading: p.notebook.reading, right: 'Caderno', emoji: '📓' },
              { id: 'p3', left: p.pencil.text, leftReading: p.pencil.reading, right: 'Lápis', emoji: '✏️' },
              { id: 'p4', left: p.teacher.text, leftReading: p.teacher.reading, right: 'Professor(a)', emoji: '👩‍🏫' },
            ],
          },
          {
            id: `${lang}-school-l1-e3`,
            type: 'listen_build',
            skill: 'listening',
            promptPt: 'Monte a frase do recreio: "Vamos brincar juntos!":',
            targetText: p.playSentence.text,
            reading: p.playSentence.reading,
            ipaOrPhoneticBr: p.playSentence.phonetic,
            translationPt: 'Vamos brincar juntos!',
            brazilianTipPt: p.playSentence.tipPt,
            wordBank: [...p.playSentence.tokens, p.playSentence.distractor],
            correctTokens: p.playSentence.tokens,
          },
          {
            id: `${lang}-school-l1-e4`,
            type: 'dialogue_complete',
            skill: 'reading',
            promptPt: 'Responda para a professora na sala de aula:',
            targetText: p.schoolQuestion.answer,
            reading: p.schoolQuestion.answerReading,
            translationPt: 'Resposta na sala de aula',
            brazilianTipPt: p.schoolQuestion.tipPt,
            dialogueLines: [
              {
                speaker: 'Professor(a)',
                text: p.schoolQuestion.teacherLine,
                reading: p.schoolQuestion.teacherReading,
                translationPt: p.schoolQuestion.teacherPt,
              },
              { speaker: 'Aluno', text: '___', translationPt: 'Escolha a resposta certa', isBlank: true },
            ],
            options: [
              { id: 'a', text: p.schoolQuestion.answer, reading: p.schoolQuestion.answerReading },
              { id: 'b', text: p.schoolQuestion.wrong1 },
              { id: 'c', text: p.schoolQuestion.wrong2 },
            ],
            correctOptionId: 'a',
          },
        ],
      },
      {
        id: `${lang}-work-l2`,
        unitId: `${lang}-u-school-work`,
        order: 2,
        titlePt: 'Trabalho, Ônibus e Celular (Trabalhador)',
        subtitlePt: 'Transporte, horário do almoço, estou chegando e bom trabalho',
        durationMinutes: 4,
        xpReward: 50,
        cefr: 'A1',
        focusSkill: 'speaking',
        exercises: [
          {
            id: `${lang}-work-l2-e1`,
            type: 'picture_choice',
            skill: 'vocabulary',
            promptPt: 'Qual cartão significa "Celular" (que usamos o dia todo)?',
            targetText: p.phone.text,
            reading: p.phone.reading,
            ipaOrPhoneticBr: p.phone.phonetic,
            translationPt: 'Celular',
            brazilianTipPt: `Olhe para o celular e repita "${p.phone.text}" — memória instantânea!`,
            options: [
              { id: 'a', text: p.work.text, reading: p.work.reading, translationPt: 'Trabalho', emoji: '💼' },
              { id: 'b', text: p.bus.text, reading: p.bus.reading, translationPt: 'Ônibus', emoji: '🚌' },
              { id: 'c', text: p.phone.text, reading: p.phone.reading, translationPt: 'Celular', emoji: '📱' },
              { id: 'd', text: p.lunch.text, reading: p.lunch.reading, translationPt: 'Almoço', emoji: '🍛' },
            ],
            correctOptionId: 'c',
          },
          {
            id: `${lang}-work-l2-e2`,
            type: 'match_pairs',
            skill: 'vocabulary',
            promptPt: 'Ligue a rotina de quem trabalha todo dia!',
            targetText: `${p.work.text} / ${p.bus.text} / ${p.phone.text} / ${p.lunch.text}`,
            translationPt: 'Trabalho / Ônibus / Celular / Almoço',
            brazilianTipPt: 'Quatro palavras que todo trabalhador encontra do começo ao fim do dia!',
            pairs: [
              { id: 'p1', left: p.work.text, leftReading: p.work.reading, right: 'Trabalho', emoji: '💼' },
              { id: 'p2', left: p.bus.text, leftReading: p.bus.reading, right: 'Ônibus', emoji: '🚌' },
              { id: 'p3', left: p.phone.text, leftReading: p.phone.reading, right: 'Celular', emoji: '📱' },
              { id: 'p4', left: p.lunch.text, leftReading: p.lunch.reading, right: 'Almoço', emoji: '🍛' },
            ],
          },
          {
            id: `${lang}-work-l2-e3`,
            type: 'listen_build',
            skill: 'listening',
            promptPt: 'Monte a frase "Estou chegando / indo para o trabalho":',
            targetText: p.arrivingSentence.text,
            reading: p.arrivingSentence.reading,
            ipaOrPhoneticBr: p.arrivingSentence.phonetic,
            translationPt: 'Estou chegando / a caminho do trabalho',
            brazilianTipPt: p.arrivingSentence.tipPt,
            wordBank: [...p.arrivingSentence.tokens, p.arrivingSentence.distractor],
            correctTokens: p.arrivingSentence.tokens,
          },
          {
            id: `${lang}-work-l2-e4`,
            type: 'speak_pronounce',
            skill: 'speaking',
            promptPt: 'Fale em voz alta para desejar bom trabalho ou hora do almoço:',
            targetText: p.goodWorkSentence.text,
            reading: p.goodWorkSentence.reading,
            ipaOrPhoneticBr: p.goodWorkSentence.phonetic,
            translationPt: 'Bom trabalho / Pausa do almoço!',
            brazilianTipPt: p.goodWorkSentence.tipPt,
            acceptedSpeechVariants: p.goodWorkSentence.variants,
          },
        ],
      },
    ],
  };

  const marketScenario: ConversationScenario = {
    id: `${lang}-sc-daily-market`,
    language: lang,
    titlePt: '🛒 Compras do Dia a Dia no Mercado',
    situationPt:
      'Você foi ao mercado do bairro comprar pão, leite e arroz para casa. Cumprimente, peça os itens e pergunte o preço!',
    cefr: 'A1',
    aiRoleName: p.marketScenario.roleName,
    aiRoleTitlePt: 'Atendente do Mercado do Bairro',
    openingLine: p.marketScenario.openingLine,
    openingReading: p.marketScenario.openingReading,
    openingTranslationPt: p.marketScenario.openingPt,
    missionGoalsPt: [
      'Cumprimentar com educação',
      'Pedir pão, leite ou arroz para casa',
      'Perguntar onde está um item ou quanto custa',
    ],
    starterHints: [p.marketScenario.hint1, p.marketScenario.hint2],
  };

  return {
    units: [homeUnit, schoolWorkUnit],
    scenarios: [marketScenario],
  };
}
