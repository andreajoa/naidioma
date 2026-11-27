import type { CefrLevel, Exercise, LanguageCode, Lesson, SkillDimension, Unit } from '../types.js';

interface AsianLessonSpec {
  id: string;
  titlePt: string;
  subtitlePt: string;
  focusSkill: SkillDimension;
  choice: {
    type?: 'context_choice' | 'trap_buster' | 'dialogue_complete';
    promptPt: string;
    targetText: string;
    reading: string;
    ipa: string;
    translationPt: string;
    tipPt: string;
    options: Array<{ id: string; text: string; reading?: string; translationPt?: string }>;
    correctOptionId: string;
  };
  build: {
    promptPt: string;
    targetText: string;
    reading: string;
    ipa: string;
    translationPt: string;
    tipPt: string;
    tokens: string[];
    distractors: string[];
  };
  speak: {
    promptPt: string;
    targetText: string;
    reading: string;
    ipa: string;
    translationPt: string;
    tipPt: string;
  };
}

interface AsianUnitSpec {
  id: string;
  language: LanguageCode;
  cefr: CefrLevel;
  titlePt: string;
  descriptionPt: string;
  culturalNotePt: string;
  grammarFocusPt: string;
  lessons: AsianLessonSpec[];
}

function compileAsianUnits(specs: AsianUnitSpec[]): Unit[] {
  return specs.map((u, uIdx) => ({
    id: u.id,
    language: u.language,
    order: uIdx + 1,
    cefr: u.cefr,
    titlePt: u.titlePt,
    descriptionPt: u.descriptionPt,
    culturalNotePt: u.culturalNotePt,
    grammarFocusPt: u.grammarFocusPt,
    lessons: u.lessons.map((l, lIdx): Lesson => {
      const exercises: Exercise[] = [
        {
          id: `${l.id}-e1`,
          type: l.choice.type ?? 'context_choice',
          skill: l.choice.type === 'trap_buster' ? 'vocabulary' : 'reading',
          promptPt: l.choice.promptPt,
          targetText: l.choice.targetText,
          reading: l.choice.reading,
          ipaOrPhoneticBr: l.choice.ipa,
          translationPt: l.choice.translationPt,
          brazilianTipPt: l.choice.tipPt,
          options: l.choice.options,
          correctOptionId: l.choice.correctOptionId,
        },
        {
          id: `${l.id}-e2`,
          type: 'listen_build',
          skill: 'listening',
          promptPt: l.build.promptPt,
          targetText: l.build.targetText,
          reading: l.build.reading,
          ipaOrPhoneticBr: l.build.ipa,
          translationPt: l.build.translationPt,
          brazilianTipPt: l.build.tipPt,
          wordBank: [...l.build.tokens, ...l.build.distractors],
          correctTokens: l.build.tokens,
        },
        {
          id: `${l.id}-e3`,
          type: 'speak_pronounce',
          skill: 'speaking',
          promptPt: l.speak.promptPt,
          targetText: l.speak.targetText,
          reading: l.speak.reading,
          ipaOrPhoneticBr: l.speak.ipa,
          translationPt: l.speak.translationPt,
          brazilianTipPt: l.speak.tipPt,
        },
      ];
      return {
        id: l.id,
        unitId: u.id,
        order: lIdx + 1,
        titlePt: l.titlePt,
        subtitlePt: l.subtitlePt,
        durationMinutes: 5,
        xpReward: u.cefr === 'A1' ? 45 : u.cefr === 'A2' ? 55 : u.cefr === 'B1' ? 65 : u.cefr === 'B2' ? 75 : 85,
        cefr: u.cefr,
        focusSkill: l.focusSkill,
        exercises,
      };
    }),
  }));
}

export const KOREAN_MASTERY_UNITS: Unit[] = compileAsianUnits([
  // ==================== COREANO A1 EXTRA ====================
  {
    id: 'ko-a1-u6',
    language: 'ko',
    cefr: 'A1',
    titlePt: 'Partículas Essenciais e Família (은/는 · 이/가 · 을/를)',
    descriptionPt: 'Entenda como as partículas marcam o assunto e o objeto da frase em coreano e apresente sua família.',
    culturalNotePt: 'Em coreano, o verbo sempre fica no FINAL da frase! As partículas coladas na palavra mostram quem faz a ação e o que recebe a ação.',
    grammarFocusPt: '은/는 (tópico) · 을/를 (objeto) · Família e rotina',
    lessons: [
      {
        id: 'ko-a1-u6-l1',
        titlePt: 'Montando Frases Reais com Partículas',
        subtitlePt: '저는, 사과를, 엄마가 — a engrenagem do coreano',
        focusSkill: 'writing',
        choice: {
          promptPt: 'Como dizer "Eu gosto de maçã" com a partícula certa?',
          targetText: '저는 사과를 좋아해요.',
          reading: 'Jeo-neun sa-gwa-reul jo-a-hae-yo.',
          ipa: 'Djó-nân sa-guá-râl djô-a-ré-io.',
          translationPt: 'Eu gosto de maçã.',
          tipPt: 'Palavra terminada em vogal (사과) recebe 를; terminada em consoante (밥) recebe 을!',
          options: [
            { id: 'a', text: '저는 사과를 좋아해요.', reading: 'Jeo-neun sa-gwa-reul jo-a-hae-yo.' },
            { id: 'b', text: '저는 좋아해요 사과.', reading: 'Jeo-neun jo-a-hae-yo sa-gwa.' },
            { id: 'c', text: '사과는 저를 해요.', reading: 'Sa-gwa-neun jeo-reul hae-yo.' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte: "Eu bebo água todos os dias":',
          targetText: '저는 매일 물을 마셔요.',
          reading: 'Jeo-neun mae-il mu-reul ma-syeo-yo.',
          ipa: 'Djó-nân mé-il mu-râl má-shó-io.',
          translationPt: 'Eu bebo água todos os dias.',
          tipPt: 'Repare na ordem: Pessoa (저는) + Quando (매일) + Objeto (물을) + Verbo no final (마셔요)!',
          tokens: ['저는', '매일', '물을', '마셔요.'],
          distractors: ['먹어요.'],
        },
        speak: {
          promptPt: 'Fale em voz alta apresentando sua família:',
          targetText: '우리 가족을 사랑해요.',
          reading: 'U-ri ga-jo-geul sa-rang-hae-yo.',
          ipa: 'U-rí gá-djô-gâl sa-ráng-ré-io.',
          translationPt: 'Eu amo a nossa família.',
          tipPt: 'Coreanos usam "우리" (nosso) em vez de "meu" para família, casa e país!',
        },
      },
    ],
  },
  // ==================== COREANO A2 ====================
  {
    id: 'ko-a2-u1',
    language: 'ko',
    cefr: 'A2',
    titlePt: 'Passado em Coreano (-았어요 / -었어요)',
    descriptionPt: 'Conte o que você comeu, comprou, assistiu e fez ontem com a conjugação real do passado polido.',
    culturalNotePt: 'Se a última vogal da raiz for ㅏ ou ㅗ, adicione -았어요 (갔어요 = fui). Para todas as outras vogais, use -었어요 (먹었어요 = comi).',
    grammarFocusPt: 'Passado -았어요 / -었어요 / 했어요 · Ontem (어제)',
    lessons: [
      {
        id: 'ko-a2-u1-l1',
        titlePt: 'O Que Você Fez Ontem?',
        subtitlePt: '갔어요 (fui) · 먹었어요 (comi) · 공부했어요 (estudei)',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Como dizer "Eu estudei coreano ontem"?',
          targetText: '어제 한국어를 공부했어요.',
          reading: 'Eo-je han-gu-geo-reul gong-bu-hae-sseo-yo.',
          ipa: 'Ó-djê rán-gu-gó-râl gông-bu-ré-ssó-io.',
          translationPt: 'Ontem eu estudei coreano.',
          tipPt: 'Todo verbo terminado em 하다 (fazer/estudar) vira 했어요 no passado!',
          options: [
            { id: 'a', text: '어제 한국어를 공부해요.', reading: 'Presente (estudo)' },
            { id: 'b', text: '어제 한국어를 공부했어요.', reading: 'Passado (estudei)' },
            { id: 'c', text: '어제 한국어를 공부할 거예요.', reading: 'Futuro (vou estudar)' },
          ],
          correctOptionId: 'b',
        },
        build: {
          promptPt: 'Monte: "Ontem eu fui ao mercado":',
          targetText: '어제 시장에 갔어요.',
          reading: 'Eo-je si-jang-e ga-sseo-yo.',
          ipa: 'Ó-djê shí-djáng-ê gá-ssó-io.',
          translationPt: 'Ontem eu fui ao mercado.',
          tipPt: 'A partícula 에 depois do lugar indica destino ("para o mercado").',
          tokens: ['어제', '시장에', '갔어요.'],
          distractors: ['가요.'],
        },
        speak: {
          promptPt: 'Fale em voz alta dizendo que comeu comida gostosa:',
          targetText: '맛있는 음식을 먹었어요.',
          reading: 'Ma-sin-neun eum-si-geul meo-geo-sseo-yo.',
          ipa: 'Má-shín-nân âm-shi-gâl mó-gó-ssó-io.',
          translationPt: 'Eu comi uma comida deliciosa.',
          tipPt: 'O ㅅ de 맛있 + ㄴ assimila som de N: "má-shín-nân"!',
        },
      },
    ],
  },
  {
    id: 'ko-a2-u2',
    language: 'ko',
    cefr: 'A2',
    titlePt: 'Futuro, Planos e Compras (-(으)ㄹ 거예요)',
    descriptionPt: 'Combine encontros no fim de semana, pergunte preços em lojas coreanas e diga o que pretende fazer amanhã.',
    culturalNotePt: 'Em lojas na Coreia, "얼마예요?" (quanto custa?) e "카드 돼요?" (aceita cartão?) resolvem 90% das compras!',
    grammarFocusPt: 'Futuro -(으)ㄹ 거예요 · Compras e preços · Tempo',
    lessons: [
      {
        id: 'ko-a2-u2-l1',
        titlePt: 'Planos Para Amanhã e Compras em Seul',
        subtitlePt: '갈 거예요 (vou ir) · 살 거예요 (vou comprar)',
        focusSkill: 'listening',
        choice: {
          promptPt: 'Como dizer "Amanhã vou encontrar meu amigo"?',
          targetText: '내일 친구를 만날 거예요.',
          reading: 'Nae-il chin-gu-reul man-nal geo-ye-yo.',
          ipa: 'Né-il tchín-gu-râl mán-nál gó-iê-io.',
          translationPt: 'Amanhã vou encontrar meu amigo.',
          tipPt: 'Raiz terminada em vogal (만나) + ㄹ 거예요 = futuro planejado!',
          options: [
            { id: 'a', text: '내일 친구를 만났어요.', reading: 'Encontrei (passado)' },
            { id: 'b', text: '내일 친구를 만날 거예요.', reading: 'Vou encontrar (futuro)' },
            { id: 'c', text: '어제 친구를 만날 거예요.', reading: 'Ontem + futuro (incoerente)' },
          ],
          correctOptionId: 'b',
        },
        build: {
          promptPt: 'Monte: "Quanto custa este pão?":',
          targetText: '이 빵은 얼마예요?',
          reading: 'I ppang-eun eol-ma-ye-yo?',
          ipa: 'Í ppáng-ân ól-má-iê-io?',
          translationPt: 'Quanto custa este pão?',
          tipPt: '빵 (ppang) veio do português "pão" levado séculos atrás para a Ásia!',
          tokens: ['이', '빵은', '얼마예요?'],
          distractors: ['어디예요?'],
        },
        speak: {
          promptPt: 'Pergunte em voz alta se pode pagar no cartão:',
          targetText: '카드로 계산할 수 있어요?',
          reading: 'Ka-deu-ro gye-san-hal su i-sseo-yo?',
          ipa: 'Cá-dâ-rô guê-sán-rál sú í-ssó-io?',
          translationPt: 'Posso pagar com cartão?',
          tipPt: '-(으)ㄹ 수 있어요 = "posso / consigo fazer algo".',
        },
      },
    ],
  },
  {
    id: 'ko-a2-u3',
    language: 'ko',
    cefr: 'A2',
    titlePt: 'Saúde, Farmácia e Transporte em Seul',
    descriptionPt: 'Peça remédio na farmácia, explique onde dói e pegue metrô ou ônibus usando direções reais em coreano.',
    culturalNotePt: 'O metrô de Seul (지하철) é um dos melhores do mundo; saber dizer "어디에서 갈아타요?" (onde faço baldeação?) te leva a qualquer bairro.',
    grammarFocusPt: '아파요 (dói) · -에서 (local da ação) · Baldeação e direções',
    lessons: [
      {
        id: 'ko-a2-u3-l1',
        titlePt: 'Na Farmácia e no Metrô',
        subtitlePt: '머리가 아파요 (dor de cabeça) · 지하철역 (estação de metrô)',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Você está com dor de cabeça na farmácia. Como explicar?',
          targetText: '머리가 아파서 약을 주세요.',
          reading: 'Meo-ri-ga a-pa-seo ya-geul ju-se-yo.',
          ipa: 'Mó-rí-gá á-pá-só iá-gâl djú-sê-io.',
          translationPt: 'Minha cabeça dói, então me dê um remédio por favor.',
          tipPt: '-아서/어서 liga causa e consequência ("porque dói, me dê...").',
          options: [
            { id: 'a', text: '머리가 아파서 약을 주세요.', reading: 'Dor de cabeça → remédio' },
            { id: 'b', text: '머리가 맛있어요.', reading: 'Cabeça gostosa (errado!)' },
            { id: 'c', text: '약이 어디로 가요?', reading: 'Onde o remédio vai?' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte: "Onde fica a estação de metrô?":',
          targetText: '지하철역이 어디에 있어요?',
          reading: 'Ji-ha-cheol-yeo-gi eo-di-e i-sseo-yo?',
          ipa: 'Djí-rá-tchól-ió-guí ó-di-ê í-ssó-io?',
          translationPt: 'Onde fica a estação de metrô?',
          tipPt: '지하 (subterrâneo) + 철 (ferrovia) + 역 (estação) = estação de metrô!',
          tokens: ['지하철역이', '어디에', '있어요?'],
          distractors: ['없어요?'],
        },
        speak: {
          promptPt: 'Peça em voz alta para parar na próxima parada:',
          targetText: '다음 정류장에서 내릴게요.',
          reading: 'Da-eum jeong-nyu-jang-e-seo nae-ril-ge-yo.',
          ipa: 'Dá-âm djóng-niú-djáng-ê-só né-ríl-guê-io.',
          translationPt: 'Vou descer no próximo ponto.',
          tipPt: '-(으)ㄹ게요 indica sua intenção imediata para quem está ouvindo.',
        },
      },
    ],
  },
  // ==================== COREANO B1 ====================
  {
    id: 'ko-b1-u1',
    language: 'ko',
    cefr: 'B1',
    titlePt: 'Conectores, Regras e Experiências (지만 · -아/어 본 적)',
    descriptionPt: 'Ligue ideias com "mas", "porque", fale de regras ("tem que / não pode") e conte experiências que já viveu.',
    culturalNotePt: 'No B1 você deixa de falar frases soltas e passa a contar histórias inteiras ligando cláusulas no meio da frase!',
    grammarFocusPt: '-지만 (mas) · -아/어야 돼요 (precisa) · -아/어 본 적이 있어요 (já fiz)',
    lessons: [
      {
        id: 'ko-b1-u1-l1',
        titlePt: 'Contando Experiências e Contrastes',
        subtitlePt: 'Fale o que já experimentou na vida',
        focusSkill: 'writing',
        choice: {
          promptPt: 'Como dizer "Coreano é difícil, mas muito divertido"?',
          targetText: '한국어는 어렵지만 아주 재미있어요.',
          reading: 'Han-gu-geo-neun eo-ryeop-ji-man a-ju jae-mi-i-sseo-yo.',
          ipa: 'Rán-gu-gó-nân ó-rióptchí-mán á-djú djé-mí-í-ssó-io.',
          translationPt: 'Coreano é difícil, mas muito divertido.',
          tipPt: 'Basta colar -지만 na raiz do verbo/adjetivo para criar "mas / porém"!',
          options: [
            { id: 'a', text: '한국어는 어렵지만 아주 재미있어요.', reading: '어렵지만 = difícil, mas' },
            { id: 'b', text: '한국어는 어렵고 없어요.', reading: 'Incorreto' },
            { id: 'c', text: '한국어는 재미있어서 어려워요.', reading: 'Porque é divertido é difícil' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte: "Eu já comi comida coreana":',
          targetText: '한국 음식을 먹어 본 적이 있어요.',
          reading: 'Han-guk eum-si-geul meo-geo bon jeo-gi i-sseo-yo.',
          ipa: 'Rán-gúk âm-shi-gâl mó-gó bôn djó-guí í-ssó-io.',
          translationPt: 'Eu já experimentei comida coreana.',
          tipPt: '-아/어 본 적이 있어요 equivale ao "I have ever..." do inglês!',
          tokens: ['한국', '음식을', '먹어', '본', '적이', '있어요.'],
          distractors: ['없어요.'],
        },
        speak: {
          promptPt: 'Diga em voz alta que precisa praticar todo dia:',
          targetText: '매일 조금씩 연습해야 돼요.',
          reading: 'Mae-il jo-geum-ssik yeon-seup-hae-ya dwae-yo.',
          ipa: 'Mé-il djô-gâm-sshík ión-sâp-ré-iá dué-io.',
          translationPt: 'Preciso praticar um pouquinho todos os dias.',
          tipPt: '-아/어야 돼요 significa "precisa / tem que fazer".',
        },
      },
    ],
  },
  // ==================== COREANO B2 ====================
  {
    id: 'ko-b2-u1',
    language: 'ko',
    cefr: 'B2',
    titlePt: 'Discurso Indireto & Níveis de Polidez (존댓말 vs 반말)',
    descriptionPt: 'Relate o que outras pessoas disseram (-다고 해요) e domine o respeito social que todo falante maduro na Coreia precisa dominar.',
    culturalNotePt: 'Na Coreia, alternar corretamente entre 반말 (íntimo), 해요체 (educado diário) e 하십시오체 (formal de trabalho) é essencial para ser levado a sério.',
    grammarFocusPt: 'Discurso indireto (-다고 해요 / -자고 해요) · Polidez formal',
    lessons: [
      {
        id: 'ko-b2-u1-l1',
        titlePt: 'Relatando Conversas e Reuniões',
        subtitlePt: 'Fale o que colegas, professores e notícias disseram',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Como relatar "O chefe disse que a reunião começa amanhã"?',
          targetText: '팀장님이 회의가 내일 시작된다고 했어요.',
          reading: 'Tim-jang-ni-mi hoe-ui-ga nae-il si-jak-doen-da-go hae-sseo-yo.',
          ipa: 'Tím-djáng-ní-mí ruê-í-gá né-il shí-dják-duên-dá-gô ré-ssó-io.',
          translationPt: 'O líder do time disse que a reunião começa amanhã.',
          tipPt: '-ㄴ/는다고 했어요 é a estrutura padrão para citar declarações em coreano B2.',
          options: [
            { id: 'a', text: '팀장님이 회의가 내일 시작된다고 했어요.', reading: 'Discurso indireto correto' },
            { id: 'b', text: '팀장님이 회의가 내일 시작해요.', reading: 'Sem discurso indireto' },
            { id: 'c', text: '팀장님이 회의가 어제 시작된다고 해요.', reading: 'Tempo incorreto' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte a frase formal de trabalho: "Muito obrigado pela oportunidade":',
          targetText: '좋은 기회를 주셔서 진심으로 감사합니다.',
          reading: 'Jo-eun gi-hoe-reul ju-syeo-seo jin-si-meu-ro gam-sa-ham-ni-da.',
          ipa: 'Djô-ân guí-ruê-râl djú-shó-só djín-shi-mâ-rô gám-sá-rám-ni-dá.',
          translationPt: 'Agradeço sinceramente por me dar uma ótima oportunidade.',
          tipPt: '주셔서 usa o honorífico -시- para mostrar respeito elevado a quem deu a oportunidade.',
          tokens: ['좋은', '기회를', '주셔서', '진심으로', '감사합니다.'],
          distractors: ['고마워.'],
        },
        speak: {
          promptPt: 'Fale em voz alta confirmando alinhamento no trabalho:',
          targetText: '일정을 확인한 후에 다시 연락드리겠습니다.',
          reading: 'Il-jeong-eul hwa-gin-han hu-e da-si yeol-lak-deu-ri-ge-sseum-ni-da.',
          ipa: 'Íl-djóng-âl ruá-guín-rán rú-ê dá-shí iól-lák-dâ-rí-guê-ssâm-ni-dá.',
          translationPt: 'Entrarei em contato novamente após conferir a agenda.',
          tipPt: '드리다 é a forma humilde de 주다 (dar), usada ao falar com superiores ou clientes.',
        },
      },
    ],
  },
  // ==================== COREANO C1 ====================
  {
    id: 'ko-c1-u1',
    language: 'ko',
    cefr: 'C1',
    titlePt: 'Argumentação Avançada & Coreano Executivo (TOPIK II)',
    descriptionPt: 'Use conectores sofisticados (-는 반면에, -기 마련이다) para contrastar ideias, debater tecnologia e defender decisões.',
    culturalNotePt: 'Estruturas como "-는 반면에" (por outro lado / ao passo que) e "-기 마련이다" (é natural/inevitável que) são cobradas nos níveis 5 e 6 do TOPIK!',
    grammarFocusPt: '-는 반면에 (contraste) · -기 마련이다 (tendência natural) · Precisão lexical',
    lessons: [
      {
        id: 'ko-c1-u1-l1',
        titlePt: 'Contrastando Prós e Contras no Nível C1',
        subtitlePt: 'Fale com profundidade sobre trabalho, educação e sociedade',
        focusSkill: 'writing',
        choice: {
          promptPt: 'Qual frase expressa "Quanto mais você pratica, mais natural fica"?',
          targetText: '꾸준히 연습할수록 말하기가 자연스러워지기 마련입니다.',
          reading: 'Kku-jun-hi yeon-seu-pal-su-rok mal-ha-gi-ga ja-yeon-seu-reo-wo-ji-gi ma-ryeo-nim-ni-da.',
          ipa: 'Kku-djún-rí ión-sâ-pál-su-rôk mál-rá-guí-gá djá-ión-sâ-ró-uó-djí-guí má-rió-ním-ni-dá.',
          translationPt: 'Quanto mais se pratica com constância, inevitavelmente a fala se torna mais natural.',
          tipPt: '-(으)ㄹ수록 = "quanto mais..." · -기 마련이다 = "é inevitável/natural que aconteça".',
          options: [
            { id: 'a', text: '꾸준히 연습할수록 말하기가 자연스러워지기 마련입니다.', reading: 'Estrutura C1 correta' },
            { id: 'b', text: '연습하고 자연스러워요.', reading: 'Simples demais (A1)' },
            { id: 'c', text: '연습하면 안 자연스러워요.', reading: 'Sentido oposto' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte a frase contrastiva com 반면에:',
          targetText: '장점이 있는 반면에 단점도 분명히 존재합니다.',
          reading: 'Jang-jeo-mi in-neun ban-myeo-ne dan-jeom-do bun-myeong-hi jon-jae-ham-ni-da.',
          ipa: 'Djáng-djó-mí ín-nân bán-mió-nê dán-djóm-dô bún-mióng-rí djôn-djé-rám-ni-dá.',
          translationPt: 'Embora haja vantagens, claramente também existem desvantagens.',
          tipPt: '장점 (ponto forte) vs 단점 (ponto fraco) — par clássico de debates em coreano!',
          tokens: ['장점이', '있는', '반면에', '단점도', '분명히', '존재합니다.'],
          distractors: ['그래서'],
        },
        speak: {
          promptPt: 'Defenda uma decisão executiva em voz alta:',
          targetText: '단기적인 비용보다 장기적인 신뢰가 훨씬 중요합니다.',
          reading: 'Dan-gi-jeo-gin bi-yong-bo-da jang-gi-jeo-gin sil-loe-ga hwol-ssin jung-yo-ham-ni-da.',
          ipa: 'Dán-guí-djó-guín bí-ióng-bô-dá djáng-guí-djó-guín shíl-luê-gá ruól-sshín djúng-iô-rám-ni-dá.',
          translationPt: 'A confiança de longo prazo é muito mais importante do que o custo de curto prazo.',
          tipPt: '신뢰 (confiança) se pronuncia "shíl-luê" pela assimilação de ㄴ+ㄹ!',
        },
      },
    ],
  },
  // ==================== COREANO C2 ====================
  {
    id: 'ko-c2-u1',
    language: 'ko',
    cefr: 'C2',
    titlePt: 'Maestria Nativa: Provérbios (속담), Subtexto e Fluência Total',
    descriptionPt: 'Domine provérbios coreanos usados no dia a dia, nuances culturais sutis (눈치) e a expressão espontânea de um nativo.',
    culturalNotePt: 'Usar um provérbio como "시작이 반이다" (começar já é metade do caminho) no momento certo encanta qualquer coreano nativo!',
    grammarFocusPt: '속담 (Provérbios) · 사자성어 (Expressões de 4 caracteres) · Fluência Nativa C2',
    lessons: [
      {
        id: 'ko-c2-u1-l1',
        titlePt: 'Provérbios Vivos e Pensamento Nativo Coreano',
        subtitlePt: 'Fale com alma, humor e naturalidade coreana',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Qual provérbio coreano equivale a "Um bom começo já é metade do caminho"?',
          targetText: '시작이 반이다.',
          reading: 'Si-ja-gi ba-ni-da.',
          ipa: 'Shí-djá-guí bá-ní-dá.',
          translationPt: 'Começar já é metade.',
          tipPt: '시작 (início) + 반 (metade) — um dos provérbios mais usados na Coreia para incentivar quem começa algo novo!',
          options: [
            { id: 'a', text: '시작이 반이다.', reading: 'Começar é metade' },
            { id: 'b', text: '백지장도 맞들면 낫다.', reading: 'A união faz a força' },
            { id: 'c', text: '소 잃고 외양간 고친다.', reading: 'Fechar a porta depois do roubo' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte a frase celebrando a fluência nativa em coreano:',
          targetText: '이제는 한국어로 자유롭게 생각하고 표현할 수 있습니다.',
          reading: 'I-je-neun han-gu-geo-ro ja-yu-rop-ge saeng-ga-ka-go pyo-hyeon-hal su i-sseum-ni-da.',
          ipa: 'Í-djê-nân rán-gu-gó-rô djá-iú-róp-guê séng-gá-ká-gô piô-rión-rál sú í-ssâm-ni-dá.',
          translationPt: 'Agora consigo pensar e me expressar livremente em coreano.',
          tipPt: '자유롭게 = livremente · 표현하다 = expressar-se.',
          tokens: ['이제는', '한국어로', '자유롭게', '생각하고', '표현할', '수', '있습니다.'],
          distractors: ['어렵게'],
        },
        speak: {
          promptPt: 'Fale o provérbio coreano sobre união em voz alta:',
          targetText: '백지장도 맞들면 낫다.',
          reading: 'Baek-ji-jang-do mat-deul-myeon nat-da.',
          ipa: 'Bék-djí-djáng-dô mát-dâl-mión nát-dá.',
          translationPt: 'Até uma folha de papel fica mais leve quando carregada juntos.',
          tipPt: 'Um dos provérbios mais bonitos sobre cooperação e trabalho em equipe na Coreia!',
        },
      },
    ],
  },
]);

export const JAPANESE_MASTERY_UNITS: Unit[] = compileAsianUnits([
  {
    id: 'ja-a2-u1',
    language: 'ja',
    cefr: 'A2',
    titlePt: 'Passado, Rotina e Forma-Te (ました / ています)',
    descriptionPt: 'Conte o que fez ontem, peça favores educados com ください e descreva ações em andamento no cotidiano japonês.',
    culturalNotePt: 'A forma-Te (食べて, 行って, 見て) é a chave-mestra do japonês: ela liga frases, pede favores e forma o gerúndio!',
    grammarFocusPt: 'Passado -ました · Forma-Te (てください / ています) · Compras e tempo',
    lessons: [
      {
        id: 'ja-a2-u1-l1',
        titlePt: 'O Que Fiz Ontem e Pedidos Educados',
        subtitlePt: '行きました (fui) · 食べました (comi) · 教えてください (me ensine)',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Como dizer "Ontem fui ao supermercado e comprei frutas"?',
          targetText: 'きのうスーパーへ行って、くだものを買いました。',
          reading: 'Kinou suupaa e itte, kudamono o kaimashita.',
          ipa: 'Ki-nôu sú-pá ê ít-tê, ku-dá-mô-no ô cái-má-shí-tá.',
          translationPt: 'Ontem fui ao supermercado e comprei frutas.',
          tipPt: 'A forma-Te (行って) conecta duas ações em sequência ("fui E comprei")!',
          options: [
            { id: 'a', text: 'きのうスーパーへ行って、くだものを買いました。', reading: 'Passado correto' },
            { id: 'b', text: 'あしたスーパーへ行きました。', reading: 'Amanhã + passado (erro)' },
            { id: 'c', text: 'きのうスーパーを食べました。', reading: 'Comi o supermercado (erro!)' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte: "Por favor, fale um pouco mais devagar":',
          targetText: 'もう少しゆっくり話してください。',
          reading: 'Mou sukoshi yukkuri hanashite kudasai.',
          ipa: 'Môu su-kô-shí iúk-ku-rí rá-ná-shí-tê ku-dá-sái.',
          translationPt: 'Por favor, fale um pouco mais devagar.',
          tipPt: 'ゆっくり (yukkuri) = devagar/com calma · 話してください = fale por favor.',
          tokens: ['もう少し', 'ゆっくり', '話して', 'ください。'],
          distractors: ['早く'],
        },
        speak: {
          promptPt: 'Diga em voz alta que está estudando japonês todos os dias:',
          targetText: '毎日日本語を勉強しています。',
          reading: 'Mainichi nihongo o benkyou shite imasu.',
          ipa: 'Mái-ní-tchí ni-rôn-gô ô bên-kiôu shí-tê i-má-su.',
          translationPt: 'Estou estudando japonês todos os dias.',
          tipPt: 'ています expressa tanto algo acontecendo agora quanto um hábito contínuo!',
        },
      },
    ],
  },
  {
    id: 'ja-b1-u1',
    language: 'ja',
    cefr: 'B1',
    titlePt: 'Forma Informal, Condicionais (たら) e Viagens',
    descriptionPt: 'Entenda conversas reais entre amigos (forma dicionário), crie condições com たら e resolva situações de viagem no Japão.',
    culturalNotePt: 'Em animes e entre amigos, quase ninguém usa ます o tempo todo — dominar a forma curta (食べる, 行った) destrava sua compreensão real!',
    grammarFocusPt: 'Forma Curta vs Polida · Condicional -たら · ことができます (conseguir)',
    lessons: [
      {
        id: 'ja-b1-u1-l1',
        titlePt: 'Condições, Permissões e Autonomia no Japão',
        subtitlePt: 'Se tiver tempo · Posso tirar foto?',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Como perguntar educadamente "Posso tirar uma foto aqui?" num templo japonês?',
          targetText: 'ここで写真を撮ってもいいですか。',
          reading: 'Koko de shashin o tottemo ii desu ka.',
          ipa: 'Cô-cô dê shá-shín ô tôt-tê-mô í dês ká.',
          translationPt: 'Posso tirar uma foto aqui?',
          tipPt: 'Forma-Te + もいいですか é a fórmula universal para pedir permissão no Japão!',
          options: [
            { id: 'a', text: 'ここで写真を撮ってもいいですか。', reading: 'Pedido de permissão correto' },
            { id: 'b', text: 'ここで写真を撮らないで。', reading: 'Não tire foto' },
            { id: 'c', text: '写真はどこを飲みますか。', reading: 'Incorreto' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte: "Se eu for ao Japão, quero visitar Quioto":',
          targetText: '日本へ行ったら、京都に行きたいです。',
          reading: 'Nihon e ittara, Kyouto ni ikitai desu.',
          ipa: 'Ni-rôn ê ít-tá-rá, Kiôu-tô ni i-kí-tái dês.',
          translationPt: 'Quando/Se eu for ao Japão, quero ir a Quioto.',
          tipPt: '行ったら (ittara) = "se/quando for" · 行きたい (ikitai) = "quero ir".',
          tokens: ['日本へ', '行ったら、', '京都に', '行きたいです。'],
          distractors: ['行きました。'],
        },
        speak: {
          promptPt: 'Fale em voz alta que você consegue ler Hiragana:',
          targetText: 'ひらがなを読むことができます。',
          reading: 'Hiragana o yomu koto ga dekimasu.',
          ipa: 'Ri-rá-gá-ná ô iô-mú cô-tô gá dê-kí-má-su.',
          translationPt: 'Eu consigo ler Hiragana.',
          tipPt: 'Verbo na forma dicionário + ことができます = "conseguir fazer".',
        },
      },
    ],
  },
  {
    id: 'ja-b2-u1',
    language: 'ja',
    cefr: 'B2',
    titlePt: 'Keigo (敬語), Passiva e Japonês Profissional',
    descriptionPt: 'Use linguagem de respeito em empresas e atendimento japonês e domine voz passiva e causativa em contexto real.',
    culturalNotePt: 'No Japão profissional, Keigo (敬語) separa quem fala como turista de quem pode trabalhar numa empresa japonesa.',
    grammarFocusPt: 'Sonkeigo / Kenjougo (敬語) · Passiva -られる · Trabalho',
    lessons: [
      {
        id: 'ja-b2-u1-l1',
        titlePt: 'Keigo na Prática em Reuniões e Atendimento',
        subtitlePt: 'Fale com polidez corporativa autêntica',
        focusSkill: 'writing',
        choice: {
          promptPt: 'Como confirmar com educação executiva "Entendido, vou verificar imediatamente"?',
          targetText: 'かしこまりました。すぐに確認いたします。',
          reading: 'Kashikomarimashita. Sugu ni kakunin itashimasu.',
          ipa: 'Cá-shí-cô-má-rí-má-shí-tá. Sú-gú ní cá-kú-nín í-tá-shí-má-su.',
          translationPt: 'Certamente. Verificarei imediatamente.',
          tipPt: 'いたします é a forma humilde (Kenjougo) de します, usada para falar das próprias ações com clientes/superiores.',
          options: [
            { id: 'a', text: 'かしこまりました。すぐに確認いたします。', reading: 'Keigo profissional' },
            { id: 'b', text: 'うん、あとで見るよ。', reading: 'Informal demais' },
            { id: 'c', text: '確認なさいました。', reading: 'Inverte sujeito' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte: "Obrigado por reservar seu tempo hoje":',
          targetText: '本日はお時間をいただき、ありがとうございます。',
          reading: 'Honjitsu wa ojikan o itadaki, arigatou gozaimasu.',
          ipa: 'Rôn-djí-tsú uá ô-djí-kán ô í-tá-dá-kí, á-rí-gá-tôu gô-zái-má-su.',
          translationPt: 'Muito obrigado por nos conceder seu tempo hoje.',
          tipPt: '本日 (honjitsu) é a versão formal de 今日 (hoje) em reuniões.',
          tokens: ['本日は', 'お時間を', 'いただき、', 'ありがとうございます。'],
          distractors: ['きのうは'],
        },
        speak: {
          promptPt: 'Fale em voz alta agradecendo ao fim de uma reunião:',
          targetText: '引き続きよろしくお願いいたします。',
          reading: 'Hikitsuzuki yoroshiku onegai itashimasu.',
          ipa: 'Ri-kí-tsú-zú-kí iô-rô-shí-kú ô-nê-gái í-tá-shí-má-su.',
          translationPt: 'Conto continuamente com a sua colaboração.',
          tipPt: 'A frase nº 1 de encerramento de e-mails e reuniões no Japão!',
        },
      },
    ],
  },
  {
    id: 'ja-c1-u1',
    language: 'ja',
    cefr: 'C1',
    titlePt: 'Estruturas Avançadas JLPT N1 & Nuances Culturais',
    descriptionPt: 'Expresse concessões formais (にもかかわらず), restrições morais (わけにはいかない) e leia o subtexto japonês.',
    culturalNotePt: 'Na cultura japonesa, "ちょっと難しいですね" ("é um pouco difícil") geralmente é uma recusa educada definitiva!',
    grammarFocusPt: 'にもかかわらず (apesar de) · わけにはいかない (não poder deixar de) · Subtexto',
    lessons: [
      {
        id: 'ja-c1-u1-l1',
        titlePt: 'Argumentação e Concessões de Nível N1',
        subtitlePt: 'Fale e entenda japonês de notícias e diretoria',
        focusSkill: 'reading',
        choice: {
          promptPt: 'Qual frase significa "Apesar das dificuldades, nunca desistimos do projeto"?',
          targetText: '困難にもかかわらず、最後まであきらめませんでした。',
          reading: 'Konnan ni mo kakawarazu, saigo made akiramemasen deshita.',
          ipa: 'Côn-nán ní mô cá-cá-uá-rá-zú, sái-gô má-dê á-kí-rá-mê-má-sên dê-shí-tá.',
          translationPt: 'Apesar das dificuldades, não desistimos até o fim.',
          tipPt: 'にもかかわらず é um conector N1 de forte impacto para contrastes formais.',
          options: [
            { id: 'a', text: '困難にもかかわらず、最後まであきらめませんでした。', reading: 'Estrutura C1 correta' },
            { id: 'b', text: '困難だからあきらめました。', reading: 'Desistimos porque era difícil' },
            { id: 'c', text: '困難のために寝ました。', reading: 'Sem relação' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte: "Como fiz uma promessa, não posso faltar":',
          targetText: '約束したので、行かないわけにはいきません。',
          reading: 'Yakusoku shita node, ikanai wake ni wa ikimasen.',
          ipa: 'Iá-kú-sô-kú shí-tá nô-dê, í-ká-nái uá-kê ní uá í-kí-má-sên.',
          translationPt: 'Como prometi, não posso deixar de ir.',
          tipPt: 'ないわけにはいかない = "não há como não fazer" (obrigação ética/social).',
          tokens: ['約束したので、', '行かない', 'わけには', 'いきません。'],
          distractors: ['行きます。'],
        },
        speak: {
          promptPt: 'Fale em voz alta destacando visão de longo prazo:',
          targetText: '長期的な視点で判断することが不可欠です。',
          reading: 'Choukiteki na shiten de handan suru koto ga fukaketsu desu.',
          ipa: 'Tchôu-kí-tê-kí ná shí-tên dê rán-dán sú-rú cô-tô gá fú-ká-kê-tsú dês.',
          translationPt: 'É indispensável julgar com uma perspectiva de longo prazo.',
          tipPt: '不可欠 (fukaketsu) = indispensável / essencial.',
        },
      },
    ],
  },
  {
    id: 'ja-c2-u1',
    language: 'ja',
    cefr: 'C2',
    titlePt: 'Maestria Nativa: Provérbios (ことわざ) e Expressão Plena',
    descriptionPt: 'Domine provérbios clássicos, estilo refinado e naturalidade absoluta para conversar, debater e pensar em japonês.',
    culturalNotePt: 'Provérbios como "七転び八起き" (cair sete vezes, levantar oito) traduzem a resiliência japonesa em 5 caracteres!',
    grammarFocusPt: 'ことわざ (Provérbios) · 四字熟語 · Fluência Nativa C2',
    lessons: [
      {
        id: 'ja-c2-u1-l1',
        titlePt: 'Provérbios Clássicos e Fluência Nativa',
        subtitlePt: 'Pensar e se expressar com alma japonesa',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Qual provérbio japonês significa "Cair sete vezes e levantar oito" (nunca desistir)?',
          targetText: '七転び八起き',
          reading: 'Nana korobi ya oki',
          ipa: 'Ná-ná cô-rô-bí iá ô-kí',
          translationPt: 'Cair sete vezes, levantar oito.',
          tipPt: 'Uma das expressões de perseverança mais admiradas no Japão!',
          options: [
            { id: 'a', text: '七転び八起き', reading: 'Cair 7, levantar 8' },
            { id: 'b', text: '一期一会', reading: 'Um encontro único na vida' },
            { id: 'c', text: '十人十色', reading: 'Dez pessoas, dez cores (cada um é único)' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte a frase de maestria: "Cada encontro na vida é único e precioso":',
          targetText: '一期一会の精神を大切にしています。',
          reading: 'Ichigo ichie no seishin o taisetsu ni shite imasu.',
          ipa: 'Í-tchí-gô í-tchí-ê nô sêi-shín ô tái-sê-tsú ní shí-tê í-má-su.',
          translationPt: 'Eu valorizo o espírito de "cada encontro é único na vida".',
          tipPt: '一期一会 (Ichigo Ichie) vem da cerimônia do chá japonesa.',
          tokens: ['一期一会の', '精神を', '大切に', 'しています。'],
          distractors: ['忘れています。'],
        },
        speak: {
          promptPt: 'Fale em voz alta celebrando a diversidade humana:',
          targetText: '十人十色だからこそ、世界は面白いのです。',
          reading: 'Juunin toiro dakara koso, sekai wa omoshiroi no desu.',
          ipa: 'Djú-nín tô-í-rô dá-ká-rá cô-sô, sê-kái uá ô-mô-shí-rôi nô dês.',
          translationPt: 'Justamente porque cada pessoa é única, o mundo é fascinante.',
          tipPt: '十人十色 (dez pessoas, dez cores) combina perfeitamente com neurodiversidade!',
        },
      },
    ],
  },
]);

export const CHINESE_MASTERY_UNITS: Unit[] = compileAsianUnits([
  {
    id: 'zh-a2-u1',
    language: 'zh',
    cefr: 'A2',
    titlePt: 'Passado (了), Experiência (过) e Comparações (比)',
    descriptionPt: 'Em mandarim o verbo não muda de forma! Aprenda as partículas 了 e 过 para falar do passado e 比 para comparar.',
    culturalNotePt: 'A grande notícia do mandarim: ZERO conjugação verbal! Você usa partículas como 了 (ação concluída) e 过 (já vivenciei) para marcar o tempo.',
    grammarFocusPt: 'Partícula 了 · Experiência 过 · Comparação A 比 B + adjetivo',
    lessons: [
      {
        id: 'zh-a2-u1-l1',
        titlePt: 'Falando do Passado e Comparando Coisas',
        subtitlePt: '买了 (comprei) · 去过 (já fui) · 比 (mais que)',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Como dizer "Ontem eu comprei frutas no supermercado"?',
          targetText: '昨天我在超市买了水果。',
          reading: 'Zuótiān wǒ zài chāoshì mǎi le shuǐguǒ.',
          ipa: 'Dzuó-tiên uó dzái tcháo-shâ mái lâ shuêi-guó.',
          translationPt: 'Ontem eu comprei frutas no supermercado.',
          tipPt: 'Ordem fixa do mandarim: Tempo (昨天) + Pessoa (我) + Lugar (在超市) + Verbo (买了) + Objeto (水果)!',
          options: [
            { id: 'a', text: '昨天我在超市买了水果。', reading: 'Ordem correta' },
            { id: 'b', text: '我买水果在超市昨天。', reading: 'Ordem de português (erro)' },
            { id: 'c', text: '明天我在超市买了水果。', reading: 'Amanhã + passado' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte: "Hoje está mais quente do que ontem":',
          targetText: '今天比昨天热。',
          reading: 'Jīntiān bǐ zuótiān rè.',
          ipa: 'Djín-tiên bí dzuó-tiên râ.',
          translationPt: 'Hoje está mais quente do que ontem.',
          tipPt: 'Fórmula mágica da comparação: A + 比 (bǐ) + B + adjetivo!',
          tokens: ['今天', '比', '昨天', '热。'],
          distractors: ['很'],
        },
        speak: {
          promptPt: 'Diga em voz alta que você já esteve na China ou gostaria de ir:',
          targetText: '我去过中国，非常喜欢。',
          reading: 'Wǒ qù guo Zhōngguó, fēicháng xǐhuan.',
          ipa: 'Uó tchiú guô Djông-guó, fêi-tcháng shí-ruán.',
          translationPt: 'Eu já fui à China e gostei muito.',
          tipPt: '去过 (qù guo) = "já fui alguma vez na vida".',
        },
      },
    ],
  },
  {
    id: 'zh-b1-u1',
    language: 'zh',
    cefr: 'B1',
    titlePt: 'Conectores (虽然...但是...) e Estrutura 把',
    descriptionPt: 'Construa frases mais longas ligando causa, contraste e a famosa estrutura 把 usada o tempo todo por nativos.',
    culturalNotePt: 'Em mandarim, conectores quase sempre trabalham em PARES: 因为...所以... (porque... então...) e 虽然...但是... (embora... mas...).',
    grammarFocusPt: '虽然...但是... · 因为...所以... · Estrutura 把',
    lessons: [
      {
        id: 'zh-b1-u1-l1',
        titlePt: 'Conectores em Pares e Organização de Frases',
        subtitlePt: 'Fale com clareza e fluidez em conversas reais',
        focusSkill: 'writing',
        choice: {
          promptPt: 'Como dizer "Embora o chinês pareça difícil, é muito lógico"?',
          targetText: '虽然中文看起来很难，但是非常有逻辑。',
          reading: 'Suīrán Zhōngwén kàn qǐlái hěn nán, dànshì fēicháng yǒu luójí.',
          ipa: 'Suêi-rán Djông-uên kán tchí-lái rên nán, dán-shâ fêi-tcháng iôu luó-djí.',
          translationPt: 'Embora o chinês pareça difícil, é muito lógico.',
          tipPt: 'Diferente do inglês, no mandarim você USA OS DOIS juntos: 虽然 (embora) + 但是 (mas)!',
          options: [
            { id: 'a', text: '虽然中文看起来很难，但是非常有逻辑。', reading: 'Par correto' },
            { id: 'b', text: '中文所以很难。', reading: 'Incorreto' },
            { id: 'c', text: '因为中文很难，但是容易。', reading: 'Par misturado' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte com 把: "Por favor, coloque o livro em cima da mesa":',
          targetText: '请把书放在桌子上。',
          reading: 'Qǐng bǎ shū fàng zài zhuōzi shàng.',
          ipa: 'Tchíng bá shú fáng dzái djuô-dzâ sháng.',
          translationPt: 'Por favor, coloque o livro na mesa.',
          tipPt: '把 traz o objeto (书) para antes do verbo quando você faz algo com ele (colocar, fechar, terminar).',
          tokens: ['请', '把', '书', '放在', '桌子上。'],
          distractors: ['吃'],
        },
        speak: {
          promptPt: 'Fale em voz alta explicando uma causa e consequência:',
          targetText: '因为每天练习，所以进步很快。',
          reading: 'Yīnwèi měitiān liànxí, suǒyǐ jìnbù hěn kuài.',
          ipa: 'Ín-uêi mêi-tiên liên-shí, suó-í djín-bú rên kuái.',
          translationPt: 'Porque pratico todos os dias, evoluo muito rápido.',
          tipPt: '进步 (jìnbù) = progresso / evolução.',
        },
      },
    ],
  },
  {
    id: 'zh-b2-u1',
    language: 'zh',
    cefr: 'B2',
    titlePt: 'Negócios, Passiva (被) e Expressões Profissionais',
    descriptionPt: 'Negocie com fornecedores e parceiros, entenda reuniões corporativas e use a voz passiva 被 com naturalidade.',
    culturalNotePt: 'Nos negócios chineses, construir relacionamento e confiança (关系 guānxì) e manter respeito mútuo é tão importante quanto o contrato.',
    grammarFocusPt: 'Voz Passiva 被 · Hipóteses 如果...就... · Negócios HSK 4-5',
    lessons: [
      {
        id: 'zh-b2-u1-l1',
        titlePt: 'Negociação e Reuniões Profissionais em Mandarim',
        subtitlePt: 'Fale sobre prazos, propostas e parcerias',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Como confirmar uma parceria com elegância numa reunião?',
          targetText: '我们非常期待与贵公司长期合作。',
          reading: 'Wǒmen fēicháng qīdài yǔ guì gōngsī chángqī hézuò.',
          ipa: 'Uó-mên fêi-tcháng tchí-dái iú guêi gông-sâ tcháng-tchí râ-dzuô.',
          translationPt: 'Aguardamos com grande expectativa uma parceria de longo prazo com sua empresa.',
          tipPt: '贵公司 (guì gōngsī) é a forma respeitosa para "sua prezada empresa".',
          options: [
            { id: 'a', text: '我们非常期待与贵公司长期合作。', reading: 'Formal e natural' },
            { id: 'b', text: '我要和你买东西。', reading: 'Básico demais' },
            { id: 'c', text: '我们不想合作。', reading: 'Sentido oposto' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte: "Se houver qualquer dúvida, entre em contato a qualquer momento":',
          targetText: '如果有任何问题，请随时联系我。',
          reading: 'Rúguǒ yǒu rènhé wèntí, qǐng suíshí liánxì wǒ.',
          ipa: 'Rú-guó iôu rên-râ uên-tí, tchíng suêi-shâ liên-shí uó.',
          translationPt: 'Se tiver qualquer dúvida, pode me contatar a qualquer hora.',
          tipPt: '随时 (suíshí) = a qualquer momento · 联系 (liánxì) = contatar.',
          tokens: ['如果', '有', '任何', '问题，', '请', '随时', '联系我。'],
          distractors: ['但是'],
        },
        speak: {
          promptPt: 'Fale em voz alta confirmando que a proposta foi aprovada:',
          targetText: '这个方案已经被批准了。',
          reading: 'Zhège fāngàn yǐjīng bèi pīzhǔn le.',
          ipa: 'Djâ-gâ fáng-án í-djíng bêi pí-djuên lâ.',
          translationPt: 'Esta proposta já foi aprovada.',
          tipPt: '被 (bèi) marca a voz passiva ("foi aprovada").',
        },
      },
    ],
  },
  {
    id: 'zh-c1-u1',
    language: 'zh',
    cefr: 'C1',
    titlePt: 'Chengyu Essenciais (成语) & Argumentação Avançada',
    descriptionPt: 'Eleve seu mandarim ao nível HSK 5–6 usando provérbios de 4 caracteres (成语) que sintetizam ideias complexas com maestria.',
    culturalNotePt: 'Chengyu (成语) são expressões clássicas de 4 caracteres que todo chinês educado usa em jornais, discursos e conversas diárias!',
    grammarFocusPt: '成语 (循序渐进 · 一举两得 · 持之以恒) · Argumentação C1',
    lessons: [
      {
        id: 'zh-c1-u1-l1',
        titlePt: 'Dominando Chengyu na Fala Real',
        subtitlePt: 'Fale como quem realmente entende a cultura chinesa',
        focusSkill: 'vocabulary',
        choice: {
          promptPt: 'Qual Chengyu significa "progredir passo a passo em ordem" (perfeito para aprender idiomas)?',
          targetText: '学习语言需要循序渐进。',
          reading: 'Xuéxí yǔyán xūyào xúnxù-jiànjìn.',
          ipa: 'Shuê-shí iú-iên shiún-shiú djiên-djín.',
          translationPt: 'Aprender um idioma exige avançar passo a passo de forma gradual.',
          tipPt: '循序渐进 (xúnxù-jiànjìn) = seguir a ordem e avançar gradualmente!',
          options: [
            { id: 'a', text: '学习语言需要循序渐进。', reading: 'Passo a passo gradual' },
            { id: 'b', text: '学习语言需要半途而废。', reading: 'Desistir no meio do caminho' },
            { id: 'c', text: '学习语言需要马马虎虎。', reading: 'Fazer de qualquer jeito' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte: "Só com perseverança constante você alcança sucesso":',
          targetText: '只有持之以恒，才能取得成功。',
          reading: 'Zhǐyǒu chízhī-yǐhéng, cáinéng qǔdé chénggōng.',
          ipa: 'Djâ-iôu tchâ-djâ-í-râng, tsái-nâng tchiú-dâ tchâng-gông.',
          translationPt: 'Somente com perseverança constante é possível alcançar o sucesso.',
          tipPt: '只有...才能... = "somente se X, então poderá Y".',
          tokens: ['只有', '持之以恒，', '才能', '取得', '成功。'],
          distractors: ['因为'],
        },
        speak: {
          promptPt: 'Fale em voz alta usando "matar dois coelhos com uma cajadada" (一举两得):',
          targetText: '这样做真是一举两得。',
          reading: 'Zhèyàng zuò zhēn shì yījǔ-liǎngdé.',
          ipa: 'Djâ-iáng dzuô djên shâ í-djiú liáng-dâ.',
          translationPt: 'Fazer assim realmente traz dois benefícios de uma só vez.',
          tipPt: '一举两得 (uma ação, dois ganhos) é um dos chengyu mais úteis no dia a dia!',
        },
      },
    ],
  },
  {
    id: 'zh-c2-u1',
    language: 'zh',
    cefr: 'C2',
    titlePt: 'Maestria Nativa: Retórica, Sabedoria e Fluência Plena',
    descriptionPt: 'Comunique-se com naturalidade de nativo em debates, escrita refinada e expressões culturais profundas.',
    culturalNotePt: 'No C2 você domina tanto o registro coloquial vivo das ruas de Pequim/Xangai quanto a elegância literária dos clássicos chineses.',
    grammarFocusPt: 'Retórica C2 · Expressões culturais profundas · Fluência Nativa',
    lessons: [
      {
        id: 'zh-c2-u1-l1',
        titlePt: 'Pensando e Argumentando Como Nativo em Mandarim',
        subtitlePt: 'Precisão cultural e eloquência completa',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Qual frase expressa com elegância C2 "Uma jornada de mil milhas começa com o primeiro passo"?',
          targetText: '千里之行，始于足下。',
          reading: 'Qiānlǐ zhī xíng, shǐ yú zúxià.',
          ipa: 'Tchiên-lí djâ shíng, shâ iú dzú-shiá.',
          translationPt: 'Uma jornada de mil milhas começa sob os seus pés.',
          tipPt: 'Clássico de Laozi citado por chineses de todas as gerações!',
          options: [
            { id: 'a', text: '千里之行，始于足下。', reading: 'Jornada de mil milhas' },
            { id: 'b', text: '今天天气很好。', reading: 'O tempo hoje está bom' },
            { id: 'c', text: '我要一杯咖啡。', reading: 'Quero um café' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte: "Agora consigo pensar e me expressar livremente em chinês":',
          targetText: '我现在能用中文自由地思考和表达。',
          reading: 'Wǒ xiànzài néng yòng Zhōngwén zìyóu de sīkǎo hé biǎodá.',
          ipa: 'Uó shiên-dzái nâng iông Djông-uên dzâ-iôu dâ sâ-cáo râ biáo-dá.',
          translationPt: 'Agora consigo pensar e me expressar livremente em chinês.',
          tipPt: '思考 (pensar profundamente) · 表达 (expressar ideias).',
          tokens: ['我', '现在', '能', '用中文', '自由地', '思考和表达。'],
          distractors: ['不能'],
        },
        speak: {
          promptPt: 'Fale o clássico provérbio em voz alta com os tons limpos:',
          targetText: '千里之行，始于足下。',
          reading: 'Qiānlǐ zhī xíng, shǐ yú zúxià.',
          ipa: 'Tchiên-lí djâ shíng, shâ iú dzú-shiá.',
          translationPt: 'Uma jornada de mil milhas começa com um único passo.',
          tipPt: 'Capriche na entonação calma e clara — você atingiu a maestria C2!',
        },
      },
    ],
  },
]);
