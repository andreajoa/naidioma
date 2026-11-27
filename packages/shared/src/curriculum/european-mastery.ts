import type { CefrLevel, Exercise, LanguageCode, Lesson, SkillDimension, Unit } from '../types.js';

interface EuroLessonSpec {
  id: string;
  titlePt: string;
  subtitlePt: string;
  focusSkill: SkillDimension;
  choice: {
    type?: 'context_choice' | 'trap_buster' | 'dialogue_complete';
    promptPt: string;
    targetText: string;
    ipa: string;
    translationPt: string;
    tipPt: string;
    options: Array<{ id: string; text: string; translationPt?: string }>;
    correctOptionId: string;
  };
  build: {
    promptPt: string;
    targetText: string;
    ipa: string;
    translationPt: string;
    tipPt: string;
    tokens: string[];
    distractors: string[];
  };
  speak: {
    promptPt: string;
    targetText: string;
    ipa: string;
    translationPt: string;
    tipPt: string;
  };
}

interface EuroUnitSpec {
  id: string;
  language: LanguageCode;
  cefr: CefrLevel;
  titlePt: string;
  descriptionPt: string;
  culturalNotePt: string;
  grammarFocusPt: string;
  lessons: EuroLessonSpec[];
}

function compileEuroUnits(specs: EuroUnitSpec[]): Unit[] {
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

export const SPANISH_MASTERY_UNITS: Unit[] = compileEuroUnits([
  {
    id: 'es-a2-u1',
    language: 'es',
    cefr: 'A2',
    titlePt: 'Fim do Portunhol: Falsos Cognatos & Passado Real',
    descriptionPt: 'Destrua armadilhas clássicas (exquisito, embarazada, propina, apellido) e fale do passado sem misturar português.',
    culturalNotePt: 'Em espanhol, "exquisito" significa DELICIOSO, "propina" é GORJETA legal de restaurante e "oficina" é ESCRITÓRIO!',
    grammarFocusPt: 'Falsos amigos BR · Pretérito Indefinido (fui, compré, hice) · Por vs Para',
    lessons: [
      {
        id: 'es-a2-u1-l1',
        titlePt: 'Armadilhas do Portunhol & Ontem',
        subtitlePt: 'Fale espanhol de verdade sem causar mal-entendidos',
        focusSkill: 'vocabulary',
        choice: {
          type: 'trap_buster',
          promptPt: 'Um garçom sorri e pergunta se o prato está bom. O que significa "La comida está exquisita"?',
          targetText: 'La comida está exquisita, muchas gracias.',
          ipa: 'La co-MÍ-da es-TÁ eks-ki-SÍ-ta, MÚ-tchas GRÁ-sias.',
          translationPt: 'A comida está deliciosa, muito obrigado.',
          tipPt: 'EXQUISITO em espanhol é um elogio máximo ("delicioso / refinado"), nunca "estranho" ("raro")!',
          options: [
            { id: 'a', text: 'La comida está exquisita, muchas gracias.' },
            { id: 'b', text: 'La comida está rara y no me gusta.' },
            { id: 'c', text: 'Yo quiero pagar la propina ilegal.' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte no passado: "Ontem fui ao mercado e comprei frutas":',
          targetText: 'Ayer fui al mercado y compré fruta fresca.',
          ipa: 'A-IÉR fui al mer-CÁ-do i com-PRÉ FRÚ-ta FRÉS-ca.',
          translationPt: 'Ontem fui ao mercado e comprei fruta fresca.',
          tipPt: '"Ayer" (ontem) pede Pretérito Indefinido: fui, compré, hice, dije.',
          tokens: ['Ayer', 'fui', 'al', 'mercado', 'y', 'compré', 'fruta', 'fresca.'],
          distractors: ['voy', 'compró'],
        },
        speak: {
          promptPt: 'Fale em voz alta sem portunhol:',
          targetText: 'Trabajo en una oficina cerca del metro.',
          ipa: 'Tra-BÁ-ro en Ú-na o-fi-SÍ-na SÉR-ca del MÉ-tro.',
          translationPt: 'Eu trabalho em um escritório perto do metrô.',
          tipPt: 'O J de "trabajo" tem som forte de R na garganta (tra-BÁ-ro), e "oficina" = escritório!',
        },
      },
    ],
  },
  {
    id: 'es-b1-u1',
    language: 'es',
    cefr: 'B1',
    titlePt: 'Por vs Para, Subjuntivo Presente e Viagens',
    descriptionPt: 'Domine a diferença exata entre POR e PARA e dê conselhos/desejos usando o Subjuntivo espanhol com segurança.',
    culturalNotePt: 'PARA indica destino, prazo ou finalidade ("para mañana", "para ti"). POR indica causa, troca ou meio ("por la lluvia", "por teléfono").',
    grammarFocusPt: 'Por vs Para · Presente de Subjuntivo (espero que tengas...) · Conselhos',
    lessons: [
      {
        id: 'es-b1-u1-l1',
        titlePt: 'Expressando Desejos e Conselhos Reais',
        subtitlePt: 'Espero que te vaya bien · Te recomiendo que...',
        focusSkill: 'speaking',
        choice: {
          type: 'trap_buster',
          promptPt: 'Qual frase usa POR e PARA corretamente?',
          targetText: 'Gracias por tu ayuda; necesito el informe para mañana.',
          ipa: 'GRÁ-sias pór tu a-IÚ-da; ne-se-SÍ-to el in-FÓR-me PA-ra ma-NHÁ-na.',
          translationPt: 'Obrigado pela sua ajuda; preciso do relatório para amanhã.',
          tipPt: 'Agradecimento/motivo = POR ("gracias por") · Prazo final = PARA ("para mañana").',
          options: [
            { id: 'a', text: 'Gracias para tu ayuda; necesito el informe por mañana.' },
            { id: 'b', text: 'Gracias por tu ayuda; necesito el informe para mañana.' },
            { id: 'c', text: 'Gracias por tu ayuda; necesito el informe en mañana.' },
          ],
          correctOptionId: 'b',
        },
        build: {
          promptPt: 'Monte com Subjuntivo: "Espero que você tenha um excelente dia":',
          targetText: 'Espero que tengas un excelente día.',
          ipa: 'Es-PÉ-ro ke TÊN-gas un ek-se-LÊN-te DÍ-a.',
          translationPt: 'Espero que você tenha um excelente dia.',
          tipPt: 'Depois de "Espero que", "Ojalá que" e "Quiero que", sempre entra Subjuntivo (tengas, puedas, seas).',
          tokens: ['Espero', 'que', 'tengas', 'un', 'excelente', 'día.'],
          distractors: ['tienes'],
        },
        speak: {
          promptPt: 'Dê uma recomendação em voz alta:',
          targetText: 'Te recomiendo que reserves con anticipación.',
          ipa: 'Te re-co-MIÊN-do ke re-SÉR-bes con an-ti-si-pa-SIÓN.',
          translationPt: 'Te recomendo que reserve com antecedência.',
          tipPt: 'V em espanhol tem o mesmo som bilabial suave que B (re-SÉR-bes).',
        },
      },
    ],
  },
  {
    id: 'es-b2-u1',
    language: 'es',
    cefr: 'B2',
    titlePt: 'Hipóteses, Trabalho Internacional e Expressões Nativas',
    descriptionPt: 'Participe de reuniões na América Latina e Espanha usando Imperfeito do Subjuntivo (si tuviera...) e modismos reais.',
    culturalNotePt: 'Em espanhol, a condicional hipotética usa "Si + Imperfecto de Subjuntivo (-ra/-se), Condicional (-ría)": "Si tuviera más tiempo, viajaría".',
    grammarFocusPt: 'Si + Subjuntivo Imperfeito + Condicional · Negociação em Espanhol',
    lessons: [
      {
        id: 'es-b2-u1-l1',
        titlePt: 'Negociação e Condicionais Avançadas',
        subtitlePt: 'Fale com autoridade em empresas hispanofalantes',
        focusSkill: 'writing',
        choice: {
          promptPt: 'Qual frase expressa corretamente "Se tivéssemos mais orçamento, ampliaríamos a equipe"?',
          targetText: 'Si tuviéramos más presupuesto, ampliaríamos el equipo.',
          ipa: 'Si tu-BIÉ-ra-mos más pre-su-PUÉS-to, am-pli-a-RÍ-a-mos el e-KÍ-po.',
          translationPt: 'Se tivéssemos mais orçamento, ampliaríamos a equipe.',
          tipPt: '"Presupuesto" = orçamento (nunca traduza "orçamento" como "orzamiento"!).',
          options: [
            { id: 'a', text: 'Si tendríamos más presupuesto, ampliaríamos el equipo.' },
            { id: 'b', text: 'Si tuviéramos más presupuesto, ampliaríamos el equipo.' },
            { id: 'c', text: 'Si tenemos más orçamento, ampliamos equipo.' },
          ],
          correctOptionId: 'b',
        },
        build: {
          promptPt: 'Monte a frase profissional para alinhar próximos passos:',
          targetText: 'Quedamos de acuerdo en revisar los resultados el viernes.',
          ipa: 'Ke-DÁ-mos de a-CUÉR-do en re-bi-SÁR los re-sul-TÁ-dos el BIÉR-nes.',
          translationPt: 'Combinamos de revisar os resultados na sexta-feira.',
          tipPt: '"Quedar de acuerdo en..." = ficar combinado / alinhado.',
          tokens: ['Quedamos', 'de', 'acuerdo', 'en', 'revisar', 'los', 'resultados', 'el', 'viernes.'],
          distractors: ['en el'],
        },
        speak: {
          promptPt: 'Fale em voz alta propondo solução:',
          targetText: 'Lo importante es encontrar una solución viable para ambos.',
          ipa: 'Lo im-por-TÁN-te es en-con-TRÁR Ú-na so-lu-SIÓN BIÁ-ble PA-ra ÁM-bos.',
          translationPt: 'O importante é encontrar uma solução viável para ambos.',
          tipPt: 'O artigo neutro "Lo" + adjetivo ("Lo importante", "Lo mejor") é super elegante e natural!',
        },
      },
    ],
  },
  {
    id: 'es-c1-u1',
    language: 'es',
    cefr: 'C1',
    titlePt: 'Conectores Cultos, Nuances e Variedades (Espanha × LatAm)',
    descriptionPt: 'Use conectores de alto nível (sin embargo, no obstante, a pesar de que) e transite com facilidade entre México, Argentina, Colômbia e Espanha.',
    culturalNotePt: 'No C1 você reconhece naturalmente "coche/carro/auto", "ordenador/computadora" e "vale/dale/órale" sem perder o ritmo.',
    grammarFocusPt: 'No obstante · A pesar de que + Subjuntivo · Registro C1',
    lessons: [
      {
        id: 'es-c1-u1-l1',
        titlePt: 'Argumentação Precisa & Diplomacia',
        subtitlePt: 'Defenda teses com rigor e naturalidade',
        focusSkill: 'reading',
        choice: {
          promptPt: 'Qual frase usa "a pesar de que" com nuance C1 para uma hipótese futura?',
          targetText: 'Seguiremos adelante a pesar de que surjan obstáculos.',
          ipa: 'Se-gui-RÉ-mos a-de-LÁN-te a pe-SÁR de ke SÚR-ran obs-TÁ-cu-los.',
          translationPt: 'Seguiremos em frente mesmo que surjam obstáculos.',
          tipPt: '"A pesar de que" + Indicativo = fato real; + Subjuntivo ("surjan") = hipótese eventual!',
          options: [
            { id: 'a', text: 'Seguiremos adelante a pesar de que surjan obstáculos.' },
            { id: 'b', text: 'Seguiremos adelante a pesar de surgiríamos obstáculos.' },
            { id: 'c', text: 'Seguiremos adelante pero aunque surjan obstáculos.' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte a síntese executiva com "Cabe destacar":',
          targetText: 'Cabe destacar que el impacto superó nuestras expectativas.',
          ipa: 'CÁ-be des-ta-CÁR ke el im-PÁK-to su-pe-RÓ NUÉS-tras eks-pek-ta-TÍ-bas.',
          translationPt: 'Vale destacar que o impacto superou nossas expectativas.',
          tipPt: '"Cabe destacar que..." = "Cumpre ressaltar que..." — muito usado em relatórios e palestras.',
          tokens: ['Cabe', 'destacar', 'que', 'el', 'impacto', 'superó', 'nuestras', 'expectativas.'],
          distractors: ['supera'],
        },
        speak: {
          promptPt: 'Fale em voz alta com clareza executiva:',
          targetText: 'No obstante los desafíos, logramos consolidar el proyecto.',
          ipa: 'No obs-TÁN-te los de-sa-FÍ-os, lo-GRÁ-mos con-so-li-DÁR el pro-IÉK-to.',
          translationPt: 'Não obstante os desafios, conseguimos consolidar o projeto.',
          tipPt: '"Lograr" = conseguir alcançar algo com esforço (muito melhor que repetir "conseguir" sempre).',
        },
      },
    ],
  },
  {
    id: 'es-c2-u1',
    language: 'es',
    cefr: 'C2',
    titlePt: 'Maestria Nativa: Modismos, Retórica e Pensamento Hispânico',
    descriptionPt: 'Fale e pense em espanhol com 0% de portunhol — dominando refranes, ironia fina e eloquência de nível nativo.',
    culturalNotePt: 'Expressões como "dar en el clavo" (acertar em cheio) e "no tener pelos en la lengua" (falar sem rodeios) dão vida nativa ao seu espanhol.',
    grammarFocusPt: 'Refranes · Modismos C2 · Retórica e Fluência Nativa',
    lessons: [
      {
        id: 'es-c2-u1-l1',
        titlePt: 'Expressões Idiomáticas & Fluência Nativa C2',
        subtitlePt: 'Zero portunhol, 100% naturalidade hispânica',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Qual expressão nativa significa "acertar exatamente no ponto central"?',
          targetText: 'Con ese diagnóstico diste justo en el clavo.',
          ipa: 'Con É-se diag-NÓS-ti-co DÍS-te RÚS-to en el CLÁ-bo.',
          translationPt: 'Com esse diagnóstico você acertou exatamente na mosca.',
          tipPt: '"Dar en el clavo" é o equivalente exato de "hit the nail on the head"!',
          options: [
            { id: 'a', text: 'Con ese diagnóstico diste justo en el clavo.' },
            { id: 'b', text: 'Con ese diagnóstico tomaste el pelo.' },
            { id: 'c', text: 'Con ese diagnóstico metiste la pata.' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte a frase de maestria C2:',
          targetText: 'Ya puedo pensar y expresarme con total naturalidad en español.',
          ipa: 'Iá PUÉ-do pen-SÁR i eks-pre-SÁR-me con to-TÁL na-tu-ra-li-DÁD en es-pa-NHÓL.',
          translationPt: 'Já consigo pensar e me expressar com total naturalidade em espanhol.',
          tipPt: 'Pronuncie o S final e as vogais abertas com clareza — marca registrada de espanhol impecável!',
          tokens: ['Ya', 'puedo', 'pensar', 'y', 'expresarme', 'con', 'total', 'naturalidad', 'en', 'español.'],
          distractors: ['portuñol.'],
        },
        speak: {
          promptPt: 'Fale o refrão nativo em voz alta:',
          targetText: 'Más vale maña que fuerza cuando el reto es complejo.',
          ipa: 'Más BÁ-le MÁ-nha ke FUÉR-sa CUÁN-do el RÉ-to es com-PLÉ-ro.',
          translationPt: 'Vale mais jeito e estratégia do que força quando o desafio é complexo.',
          tipPt: 'Um refrão clássico usado em toda a Espanha e América Latina!',
        },
      },
    ],
  },
]);

export const FRENCH_MASTERY_UNITS: Unit[] = compileEuroUnits([
  {
    id: 'fr-a2-u1',
    language: 'fr',
    cefr: 'A2',
    titlePt: 'Passé Composé, Rotina e Compras em Paris',
    descriptionPt: 'Conte o que fez ontem usando Passé Composé (j’ai mangé / je suis allé) e converse na padaria, mercado e transporte.',
    culturalNotePt: 'Em francês, a maioria dos verbos faz o passado com AVOIR (j\'ai acheté), mas verbos de deslocamento (aller, venir, arriver) usam ÊTRE (je suis allé)!',
    grammarFocusPt: 'Passé Composé (avoir vs être) · Liaison · Compras e horas',
    lessons: [
      {
        id: 'fr-a2-u1-l1',
        titlePt: 'Passé Composé: Avoir vs Être na Prática',
        subtitlePt: 'J’ai acheté (comprei) · Je suis allé(e) (fui)',
        focusSkill: 'speaking',
        choice: {
          type: 'trap_buster',
          promptPt: 'Como dizer corretamente "Ontem eu fui ao mercado"?',
          targetText: 'Hier, je suis allé au marché.',
          ipa: 'Iér, jê suí za-LÊ ô mar-SHÊ.',
          translationPt: 'Ontem, eu fui ao mercado.',
          tipPt: '"Aller" (ir) sempre usa o auxiliar ÊTRE no passado ("je suis allé", nunca "j\'ai allé")!',
          options: [
            { id: 'a', text: "Hier, j'ai allé au marché." },
            { id: 'b', text: 'Hier, je suis allé au marché.' },
            { id: 'c', text: 'Demain, je suis allé au marché.' },
          ],
          correctOptionId: 'b',
        },
        build: {
          promptPt: 'Monte: "Eu comprei pão fresco na padaria":',
          targetText: "J'ai acheté du pain frais à la boulangerie.",
          ipa: 'Jê ash-TÊ diu pãn fré a la bu-lãn-jê-RÍ.',
          translationPt: 'Eu comprei pão fresco na padaria.',
          tipPt: 'O artigo partitivo "du pain" significa "um pouco de pão / pão".',
          tokens: ["J'ai", 'acheté', 'du', 'pain', 'frais', 'à', 'la', 'boulangerie.'],
          distractors: ['suis'],
        },
        speak: {
          promptPt: 'Fale em voz alta perguntando o preço:',
          targetText: 'Excusez-moi, combien coûte ce pull ?',
          ipa: 'Eks-kiu-zê muá, com-BIÃN cút sê piúl?',
          translationPt: 'Com licença, quanto custa este suéter?',
          tipPt: 'Sempre comece com "Bonjour" ou "Excusez-moi" na França — polidez abre todas as portas!',
        },
      },
    ],
  },
  {
    id: 'fr-b1-u1',
    language: 'fr',
    cefr: 'B1',
    titlePt: 'Imparfait vs Passé Composé & Pronomes Y / EN',
    descriptionPt: 'Conte histórias diferenciando cenário (Imparfait) de ação pontual (Passé Composé) e use Y e EN como um francófono real.',
    culturalNotePt: '"J\'y vais!" (Estou indo lá!) e "J\'en veux" (Eu quero disso!) — os pronomes minúsculos Y e EN aparecem em 1 a cada 3 frases em francês.',
    grammarFocusPt: 'Imparfait vs Passé Composé · Pronomes Y e EN · Conselhos',
    lessons: [
      {
        id: 'fr-b1-u1-l1',
        titlePt: 'Contando Histórias e Usando Y / EN',
        subtitlePt: 'Fale com fluidez sobre memórias e cotidiano',
        focusSkill: 'writing',
        choice: {
          promptPt: 'Alguém pergunta "Tu vas à Lyon demain ?" (Você vai a Lyon amanhã?). Qual é a resposta mais natural?',
          targetText: "Oui, j'y vais demain matin.",
          ipa: 'Uí, ji vé dê-MÃN ma-TÃN.',
          translationPt: 'Sim, eu vou para lá amanhã de manhã.',
          tipPt: 'Y substitui um lugar com "à" ("à Lyon") para evitar repetir o nome do lugar!',
          options: [
            { id: 'a', text: "Oui, j'y vais demain matin." },
            { id: 'b', text: "Oui, j'en vais demain matin." },
            { id: 'c', text: 'Oui, je vais à lui demain.' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte: "Estava chovendo quando chegamos":',
          targetText: 'Il pleuvait quand nous sommes arrivés.',
          ipa: 'Il plêu-VÉ cãn nu sóm za-ri-VÊ.',
          translationPt: 'Estava chovendo quando chegamos.',
          tipPt: 'Cenário/clima de fundo = Imparfait (pleuvait) · Evento que aconteceu = Passé Composé (sommes arrivés).',
          tokens: ['Il', 'pleuvait', 'quand', 'nous', 'sommes', 'arrivés.'],
          distractors: ['pleut'],
        },
        speak: {
          promptPt: 'Fale em voz alta com o pronome EN:',
          targetText: "J'en ai besoin pour mon travail.",
          ipa: 'Jãn ê bê-ZUÃN pur môn tra-VÁI.',
          translationPt: 'Eu preciso disso para o meu trabalho.',
          tipPt: '"Avoir besoin DE..." usa EN para substituir "de + coisa"!',
        },
      },
    ],
  },
  {
    id: 'fr-b2-u1',
    language: 'fr',
    cefr: 'B2',
    titlePt: 'Subjonctif, Trabalho & Diplomacia Francófona',
    descriptionPt: 'Use o Subjonctif em opiniões e necessidades (Il faut que tu saches...) e conduza reuniões em Paris ou Montreal.',
    culturalNotePt: 'Na França, "Il faut que..." (É preciso que...) SEMPRE dispara o Subjonctif — dominar isso mostra francês B2 verdadeiro.',
    grammarFocusPt: 'Subjonctif Présent · Condicional de polidez · Reuniões',
    lessons: [
      {
        id: 'fr-b2-u1-l1',
        titlePt: 'Subjonctif e Negociação Profissional',
        subtitlePt: 'Il faut que nous trouvions... · Pourrions-nous...',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Qual frase usa o Subjonctif corretamente após "Il faut que"?',
          targetText: 'Il faut que nous fassions le point avant vendredi.',
          ipa: 'Il fô kê nu fa-SIÔN lê puãn a-VÃN vãn-drê-DÍ.',
          translationPt: 'É preciso que façamos um balanço antes de sexta-feira.',
          tipPt: '"Faire le point" = fazer um alinhamento / balanço · Subjonctif de faire = fassions!',
          options: [
            { id: 'a', text: 'Il faut que nous faisons le point avant vendredi.' },
            { id: 'b', text: 'Il faut que nous fassions le point avant vendredi.' },
            { id: 'c', text: 'Il faut nous faire point vendredi.' },
          ],
          correctOptionId: 'b',
        },
        build: {
          promptPt: 'Monte um pedido polido de reunião no Condicional:',
          targetText: 'Pourrions-nous décaler la réunion à jeudi ?',
          ipa: 'Pu-ri-ôn nú dê-ca-LÊ la rê-iu-NIÔN a jêu-DÍ?',
          translationPt: 'Poderíamos adiar a reunião para quinta-feira?',
          tipPt: '"Décaler" = mover/reagendar um horário ou prazo.',
          tokens: ['Pourrions-nous', 'décaler', 'la', 'réunion', 'à', 'jeudi', '?'],
          distractors: ['Pouvons'],
        },
        speak: {
          promptPt: 'Fale em voz alta concordando com uma proposta:',
          targetText: 'Cela me semble tout à fait pertinent.',
          ipa: 'Sê-lá mê SÃM-blê tu-ta-fé per-ti-NÃN.',
          translationPt: 'Isso me parece totalmente pertinente.',
          tipPt: 'Repare na ligação elegante: "tout-à-fait" (tu-ta-fé).',
        },
      },
    ],
  },
  {
    id: 'fr-c1-u1',
    language: 'fr',
    cefr: 'C1',
    titlePt: 'Conectores Elegantes & Argumentação (DALF C1)',
    descriptionPt: 'Estruture discursos com precisão cartesiana usando "bien que", "néanmoins", "d\'autant plus que" e vocabulário refinado.',
    culturalNotePt: 'A retórica francesa valoriza estrutura clara: thèse (tese) → antithèse (contraponto) → synthèse (síntese).',
    grammarFocusPt: 'Bien que + Subjonctif · Néanmoins · D’autant plus que',
    lessons: [
      {
        id: 'fr-c1-u1-l1',
        titlePt: 'Nuances e Contrapontos no Nível C1',
        subtitlePt: 'Estruture argumentos com sofisticação francesa',
        focusSkill: 'writing',
        choice: {
          promptPt: 'Qual frase usa "Bien que" (embora) corretamente no nível C1?',
          targetText: 'Bien que le défi soit complexe, les résultats sont prometteurs.',
          ipa: 'Biãn kê lê dê-FÍ suá com-PLÉKS, lê rê-ziul-TÁ sôn pro-mê-TÊR.',
          translationPt: 'Embora o desafio seja complexo, os resultados são promissores.',
          tipPt: '"Bien que" exige SEMPRE Subjonctif ("soit", nunca "est")!',
          options: [
            { id: 'a', text: 'Bien que le défi est complexe, les résultats sont bons.' },
            { id: 'b', text: 'Bien que le défi soit complexe, les résultats sont prometteurs.' },
            { id: 'c', text: 'Bien que le défi soit complexe, mais les résultats sont bons.' },
          ],
          correctOptionId: 'b',
        },
        build: {
          promptPt: 'Monte a frase com "Néanmoins" (todavia):',
          targetText: 'Le plan est ambitieux, néanmoins il reste réalisable.',
          ipa: 'Lê plãn é tãm-bi-SIÊU, nê-ãn-MUÃN il rést rê-a-li-ZÁ-blê.',
          translationPt: 'O plano é ambicioso; todavia, continua realizável.',
          tipPt: '"Néanmoins" e "Toutefois" elevam imediatamente qualquer texto ou apresentação em francês.',
          tokens: ['Le', 'plan', 'est', 'ambitieux,', 'néanmoins', 'il', 'reste', 'réalisable.'],
          distractors: ['mais'],
        },
        speak: {
          promptPt: 'Fale em voz alta reforçando um ponto-chave:',
          targetText: "C'est d'autant plus essentiel que le temps presse.",
          ipa: 'Sé dô-TÃN pliu zê-sãn-SIÉL kê lê tãn prés.',
          translationPt: 'Isso é ainda mais essencial considerando que o tempo urge.',
          tipPt: '"D\'autant plus... que" = "ainda mais... visto que".',
        },
      },
    ],
  },
  {
    id: 'fr-c2-u1',
    language: 'fr',
    cefr: 'C2',
    titlePt: 'Maestria Nativa: Idioms, Estilo & Espírito Francês',
    descriptionPt: 'Domine expressões idiomáticas vivas, humor fino e a cadência autêntica de um falante nativo de francês.',
    culturalNotePt: 'Expressões como "mettre les pieds dans le plat" (falar algo indiscreto) e "avoir le coup de foudre" mostram domínio cultural total.',
    grammarFocusPt: 'Idioms C2 · Precisão estilística · Fluência Nativa',
    lessons: [
      {
        id: 'fr-c2-u1-l1',
        titlePt: 'Expressões Nativas e Fluência Plena C2',
        subtitlePt: 'Pensar e se expressar com naturalidade francesa',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Qual expressão idiomática francesa significa "ir direto ao ponto sem rodeios"?',
          targetText: 'Allons droit au but sans tourner autour du pot.',
          ipa: 'A-LÔN druá tô biú sãn tur-NÊ ô-TÚR diu pô.',
          translationPt: 'Vamos direto ao ponto sem ficar rodeando o assunto.',
          tipPt: '"Tourner autour du pot" = ficar enrolando / rodeando o assunto!',
          options: [
            { id: 'a', text: 'Allons droit au but sans tourner autour du pot.' },
            { id: 'b', text: 'Allons casser les pieds dans la soupe.' },
            { id: 'c', text: 'Allons avoir un chat dans la gorge.' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte a frase de maestria C2:',
          targetText: 'Je peux enfin penser et m’exprimer librement en français.',
          ipa: 'Jê pêu ãn-FÃN pãn-SÊ ê meks-pri-MÊ li-brê-MÃN ãn frãn-SÉ.',
          translationPt: 'Finalmente consigo pensar e me expressar livremente em francês.',
          tipPt: 'Capriche nas vogais nasais (enfin, penser, français) sem encostar a língua no céu da boca!',
          tokens: ['Je', 'peux', 'enfin', 'penser', 'et', 'm’exprimer', 'librement', 'en', 'français.'],
          distractors: ['peut'],
        },
        speak: {
          promptPt: 'Fale o provérbio francês em voz alta:',
          targetText: 'Petit à petit, l’oiseau fait son nid.',
          ipa: 'Pê-TÍ ta pê-TÍ, luá-ZÔ fé sôn ní.',
          translationPt: 'Pouco a pouco, o passarinho constrói seu ninho.',
          tipPt: 'Liaison suave em "petit-à-petit" — o ditado mais bonito sobre constância!',
        },
      },
    ],
  },
]);

export const GERMAN_MASTERY_UNITS: Unit[] = compileEuroUnits([
  {
    id: 'de-a2-u1',
    language: 'de',
    cefr: 'A2',
    titlePt: 'Perfekt (Passado Falado), Casos & Ordem do Verbo',
    descriptionPt: 'Conte o que você fez ontem usando o Perfekt (habe gekauft / bin gefahren) e domine a posição nº 2 do verbo em alemão.',
    culturalNotePt: 'Na fala diária na Alemanha, quase todo passado usa PERFEKT: auxiliar na 2ª posição + particípio (ge-...) no FINAL da frase!',
    grammarFocusPt: 'Perfekt (haben vs sein) · Akkusativ (den/einen) · Verbo na posição 2',
    lessons: [
      {
        id: 'de-a2-u1-l1',
        titlePt: 'Falando do Passado com Perfekt',
        subtitlePt: 'Ich habe gekauft · Ich bin gefahren',
        focusSkill: 'writing',
        choice: {
          type: 'trap_buster',
          promptPt: 'Como dizer "Ontem eu comprei pão fresco" respeitando a ordem do verbo em alemão?',
          targetText: 'Gestern habe ich frisches Brot gekauft.',
          ipa: 'GUÉS-tern RÁ-be ích FRÍ-shes brôt gue-KÁUFT.',
          translationPt: 'Ontem eu comprei pão fresco.',
          tipPt: 'Regra de ouro do alemão: quando a frase começa com "Gestern", o verbo (habe) FICA na 2ª posição e o sujeito (ich) vai para a 3ª! E "gekauft" fecha a frase!',
          options: [
            { id: 'a', text: 'Gestern ich habe gekauft frisches Brot.' },
            { id: 'b', text: 'Gestern habe ich frisches Brot gekauft.' },
            { id: 'c', text: 'Gestern bin ich frisches Brot gekauft.' },
          ],
          correctOptionId: 'b',
        },
        build: {
          promptPt: 'Monte com deslocamento (auxiliar SEIN): "Eu fui de trem para Berlim":',
          targetText: 'Ich bin mit dem Zug nach Berlin gefahren.',
          ipa: 'Ích bín mít dêm tsúg nák Ber-LÍN gue-FÁ-ren.',
          translationPt: 'Eu fui de trem para Berlim.',
          tipPt: 'Verbos de movimento (gehen, fahren, fliegen) usam SEIN ("ich bin gefahren") e "mit" pede Dativ ("mit dem Zug")!',
          tokens: ['Ich', 'bin', 'mit', 'dem', 'Zug', 'nach', 'Berlin', 'gefahren.'],
          distractors: ['habe'],
        },
        speak: {
          promptPt: 'Fale em voz alta sobre o seu dia de trabalho:',
          targetText: 'Ich habe heute viel gearbeitet und gelernt.',
          ipa: 'Ích RÁ-be RÓI-te fíl gue-AR-bai-tet únt gue-LÉRNT.',
          translationPt: 'Eu trabalhei e estudei muito hoje.',
          tipPt: 'Em alemão, "eu" se pronuncia ÓI ("heute" = RÓI-te) e "v" tem som de F ("viel" = fíl)!',
        },
      },
    ],
  },
  {
    id: 'de-b1-u1',
    language: 'de',
    cefr: 'B1',
    titlePt: 'Nebensatz (weil / dass / wenn) — O Verbo Vai pro Fim!',
    descriptionPt: 'A grande virada do alemão intermediário: conectar frases com "porque" (weil), "que" (dass) e "se/quando" (wenn).',
    culturalNotePt: 'Sempre que entra uma conjunção subordinativa (weil, dass, obwohl, wenn), o verbo conjugado viaja direto para o ÚLTIMO lugar da frase!',
    grammarFocusPt: 'Nebensatz (weil / dass / wenn) · Verbo conjugado no final',
    lessons: [
      {
        id: 'de-b1-u1-l1',
        titlePt: 'Explicando Motivos e Condições com Weil e Wenn',
        subtitlePt: 'Fale alemão conectado e natural',
        focusSkill: 'writing',
        choice: {
          type: 'trap_buster',
          promptPt: 'Qual frase usa "weil" (porque) com o verbo no lugar certo?',
          targetText: 'Ich lerne Deutsch, weil ich in Deutschland arbeiten möchte.',
          ipa: 'Ích LÉR-ne dóitch, váil ích in DÓITCH-lant ÁR-bai-ten MÊR-te.',
          translationPt: 'Eu aprendo alemão porque gostaria de trabalhar na Alemanha.',
          tipPt: 'Depois de "weil", o verbo conjugado ("möchte") OBRIGATORIAMENTE fecha a frase!',
          options: [
            { id: 'a', text: 'Ich lerne Deutsch, weil ich möchte arbeiten in Deutschland.' },
            { id: 'b', text: 'Ich lerne Deutsch, weil ich in Deutschland arbeiten möchte.' },
            { id: 'c', text: 'Ich lerne Deutsch, weil möchte ich arbeiten.' },
          ],
          correctOptionId: 'b',
        },
        build: {
          promptPt: 'Monte: "Eu acho que essa ideia é muito boa":',
          targetText: 'Ich finde, dass diese Idee sehr gut ist.',
          ipa: 'Ích FÍN-de, dás DÍ-ze i-DÊ zêr gút íst.',
          translationPt: 'Eu acho que essa ideia é muito boa.',
          tipPt: 'Com "dass", o verbo "ist" vai lá para o final!',
          tokens: ['Ich', 'finde,', 'dass', 'diese', 'Idee', 'sehr', 'gut', 'ist.'],
          distractors: ['sind.'],
        },
        speak: {
          promptPt: 'Fale em voz alta uma condição com "Wenn":',
          targetText: 'Wenn du jeden Tag übst, wirst du schnell besser.',
          ipa: 'Vên dú IÊ-den tág iúbst, vírst dú shnél BÉ-ser.',
          translationPt: 'Se você praticar todo dia, vai melhorar rápido.',
          tipPt: 'Quando a frase começa com Nebensatz ("Wenn..."), a segunda metade já começa direto pelo verbo ("wirst")!',
        },
      },
    ],
  },
  {
    id: 'de-b2-u1',
    language: 'de',
    cefr: 'B2',
    titlePt: 'Konjunktiv II, Passiv e Trabalho na Alemanha/Suíça',
    descriptionPt: 'Faça pedidos super educados, fale de hipóteses (hätte/wäre/würde) e participe de reuniões técnicas em alemão.',
    culturalNotePt: 'No ambiente corporativo alemão, objetividade (Sachlichkeit) e pontualidade são sinais máximos de respeito profissional.',
    grammarFocusPt: 'Konjunktiv II (könnten / hätten / wären) · Passiv (wird gemacht)',
    lessons: [
      {
        id: 'de-b2-u1-l1',
        titlePt: 'Polidez Executiva e Voz Passiva',
        subtitlePt: 'Könnten wir... · Das Projekt wird umgesetzt',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Como sugerir educadamente remarcar uma reunião em alemão B2?',
          targetText: 'Könnten wir den Termin auf Donnerstag verschieben?',
          ipa: 'KÊN-ten vír dên ter-MÍN áuf DÓ-ners-tag fer-SHÍ-ben?',
          translationPt: 'Poderíamos adiar o compromisso para quinta-feira?',
          tipPt: '"Könnten wir..." (Konjunktiv II) é a forma elegante e profissional de negociar.',
          options: [
            { id: 'a', text: 'Könnten wir den Termin auf Donnerstag verschieben?' },
            { id: 'b', text: 'Wir verschieben Termin jetzt.' },
            { id: 'c', text: 'Kann ich schieben der Termin?' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte na voz passiva: "A solução está sendo testada agora":',
          targetText: 'Die neue Lösung wird gerade getestet.',
          ipa: 'Dí NÓI-e LÊ-zung vírt gue-RÁ-de gue-TÉS-tet.',
          translationPt: 'A nova solução está sendo testada agora.',
          tipPt: 'Passiva em alemão usa WERDEN ("wird") + particípio no final ("getestet").',
          tokens: ['Die', 'neue', 'Lösung', 'wird', 'gerade', 'getestet.'],
          distractors: ['ist'],
        },
        speak: {
          promptPt: 'Fale em voz alta uma hipótese com Konjunktiv II:',
          targetText: 'Wenn ich mehr Zeit hätte, würde ich noch mehr lesen.',
          ipa: 'Vên ích mêr tsáit RÉ-te, VIÚR-de ích nók mêr LÊ-zen.',
          translationPt: 'Se eu tivesse mais tempo, eu leria ainda mais.',
          tipPt: '"Hätte" (tivesse) e "wäre" (fosse/estivesse) são essenciais em alemão B2!',
        },
      },
    ],
  },
  {
    id: 'de-c1-u1',
    language: 'de',
    cefr: 'C1',
    titlePt: 'Precisão Acadêmica, Nominalização & Conectores C1',
    descriptionPt: 'Domine conectores de alto nível (dennoch, insofern, obwohl), substantivos compostos e argumentação executiva.',
    culturalNotePt: 'O alemão C1 adora condensar frases inteiras com preposições de Genitiv como "trotz" (apesar de) e "aufgrund" (em virtude de).',
    grammarFocusPt: 'Genitiv (trotz / aufgrund) · Dennoch · Argumentação C1',
    lessons: [
      {
        id: 'de-c1-u1-l1',
        titlePt: 'Trotz, Aufgrund e Argumentação Executiva',
        subtitlePt: 'Fale e escreva no nível de universidades e diretorias alemãs',
        focusSkill: 'writing',
        choice: {
          promptPt: 'Qual frase usa "trotz" (apesar de) corretamente com Genitiv?',
          targetText: 'Trotz des hohen Drucks blieb das Team völlig ruhig.',
          ipa: 'Tróts dês RÔ-en drúks blíp dás tím FÊ-lig rú-ig.',
          translationPt: 'Apesar da alta pressão, a equipe permaneceu completamente calma.',
          tipPt: '"Trotz" pede Genitiv: der Druck → des Drucks!',
          options: [
            { id: 'a', text: 'Trotz des hohen Drucks blieb das Team völlig ruhig.' },
            { id: 'b', text: 'Trotz der Druck bleibt ruhig.' },
            { id: 'c', text: 'Weil des Drucks blieb das Team ruhig.' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte com "dennoch" (contudo/mesmo assim):',
          targetText: 'Die Aufgabe war anspruchsvoll, dennoch haben wir sie gemeistert.',
          ipa: 'Dí ÁUF-gá-be vár ÁN-shprúks-fól, DÉ-nók RÁ-ben vír zí gue-MÁIS-tert.',
          translationPt: 'A tarefa era exigente; contudo, nós a dominamos.',
          tipPt: '"Anspruchsvoll" = exigente/desafiador · "meistern" = dominar com excelência.',
          tokens: ['Die', 'Aufgabe', 'war', 'anspruchsvoll,', 'dennoch', 'haben', 'wir', 'sie', 'gemeistert.'],
          distractors: ['weil'],
        },
        speak: {
          promptPt: 'Fale em voz alta resumindo um ponto decisivo:',
          targetText: 'Entscheidend ist letztlich die nachhaltige Qualität.',
          ipa: 'Ent-SHÁI-dent íst LÉTS-tlich dí NÁK-rál-ti-gue cua-li-TÊT.',
          translationPt: 'O fator decisivo, em última análise, é a qualidade sustentável.',
          tipPt: '"Nachhaltig" (sustentável/duradouro) é uma das palavras-chave do alemão contemporâneo.',
        },
      },
    ],
  },
  {
    id: 'de-c2-u1',
    language: 'de',
    cefr: 'C2',
    titlePt: 'Maestria Nativa: Redewendungen, Humor & Fluência Plena',
    descriptionPt: 'Use expressões idiomáticas autênticas (Redewendungen), partículas modais (doch, mal, halt, eben) e pense direto em alemão.',
    culturalNotePt: 'As partículas modais minúsculas ("doch", "halt", "eben", "mal") são o toque secreto que transforma um alemão "correto" em alemão 100% NATIVO!',
    grammarFocusPt: 'Modalpartikeln (doch/mal/eben) · Redewendungen · Fluência Nativa C2',
    lessons: [
      {
        id: 'de-c2-u1-l1',
        titlePt: 'Partículas Modais e Expressões Nativas C2',
        subtitlePt: 'O segredo final para soar como um alemão nativo',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Qual expressão alemã significa "ir direto ao ponto central da questão"?',
          targetText: 'Du hast es genau auf den Punkt gebracht.',
          ipa: 'Dú rást és gue-NÁU áuf dên púnkt gue-BRÁKT.',
          translationPt: 'Você resumiu exatamente no ponto certo.',
          tipPt: '"Auf den Punkt bringen" = sintetizar com precisão cirúrgica!',
          options: [
            { id: 'a', text: 'Du hast es genau auf den Punkt gebracht.' },
            { id: 'b', text: 'Du verstehst nur Bahnhof.' },
            { id: 'c', text: 'Du hast Tomaten auf den Augen.' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte a frase de maestria C2:',
          targetText: 'Ich kann endlich frei auf Deutsch denken und sprechen.',
          ipa: 'Ích kán ÉNT-lich frái áuf dóitch DÊN-ken únt SHPRÉ-chen.',
          translationPt: 'Finalmente consigo pensar e falar livremente em alemão.',
          tipPt: 'Repare na pronúncia de "sprechen" (shpré-chen) e "endlich" (ént-lich)!',
          tokens: ['Ich', 'kann', 'endlich', 'frei', 'auf', 'Deutsch', 'denken', 'und', 'sprechen.'],
          distractors: ['kannst'],
        },
        speak: {
          promptPt: 'Fale o provérbio alemão clássico sobre prática:',
          targetText: 'Übung macht den Meister.',
          ipa: 'IÚ-bung mákt dên MÁIS-ter.',
          translationPt: 'A prática faz o mestre.',
          tipPt: 'Curto, icônico e usado por todo falante nativo de alemão!',
        },
      },
    ],
  },
]);

export const ITALIAN_MASTERY_UNITS: Unit[] = compileEuroUnits([
  {
    id: 'it-a2-u1',
    language: 'it',
    cefr: 'A2',
    titlePt: 'Falsos Amigos & Passato Prossimo sem Confusão',
    descriptionPt: 'Evite gafes brasileiras (burro = manteiga, salire = subir, parenti = parentes) e fale do passado com avere e essere.',
    culturalNotePt: 'Em italiano, "burro" é MANTEIGA, "caldo" é QUENTE, "guardare" é OLHAR e "salire" é SUBIR!',
    grammarFocusPt: 'Falsos amigos PT×IT · Passato Prossimo (avere vs essere) · Cotidiano',
    lessons: [
      {
        id: 'it-a2-u1-l1',
        titlePt: 'Passato Prossimo & Armadilhas para Brasileiros',
        subtitlePt: 'Ho comprato (comprei) · Sono andato (fui)',
        focusSkill: 'vocabulary',
        choice: {
          type: 'trap_buster',
          promptPt: 'No café da manhã na Itália, o que significa "Vorrei del pane con il burro"?',
          targetText: 'Vorrei del pane fresco con il burro, per favore.',
          ipa: 'Vor-RÉI del PÁ-ne FRÉS-co con il BÚR-ro, per fa-VÓ-re.',
          translationPt: 'Eu gostaria de pão fresco com manteiga, por favor.',
          tipPt: '"Burro" em italiano é manteiga! E "salire" significa subir (nunca sair = "uscire").',
          options: [
            { id: 'a', text: 'Vorrei del pane fresco con il burro, per favore.' },
            { id: 'b', text: 'Vorrei salire fuori della casa.' },
            { id: 'c', text: 'Oggi fa molto freddo, che caldo!' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte no passado: "Ontem fui ao mercado e comprei tomates":',
          targetText: 'Ieri sono andato al mercato e ho comprato i pomodori.',
          ipa: 'IÉ-ri SÔ-no an-DÁ-to al mer-CÁ-to ê ó com-PRÁ-to i po-mo-DÓ-ri.',
          translationPt: 'Ontem fui ao mercado e comprei tomates.',
          tipPt: '"Andare" usa ESSERE ("sono andato") · "Comprare" usa AVERE ("ho comprato")!',
          tokens: ['Ieri', 'sono', 'andato', 'al', 'mercato', 'e', 'ho', 'comprato', 'i', 'pomodori.'],
          distractors: ['ho andato'],
        },
        speak: {
          promptPt: 'Fale em voz alta comentando o clima:',
          targetText: 'Oggi fa molto caldo, beviamo un po’ d’acqua.',
          ipa: 'Ó-dji fá MÔL-to CÁL-do, be-VIÁ-mo um pó DÁ-cua.',
          translationPt: 'Hoje está muito quente, vamos beber um pouco de água.',
          tipPt: 'Capriche nas consoantes duplas ("oggi", "acqua") segurando o som por uma fração de segundo!',
        },
      },
    ],
  },
  {
    id: 'it-b1-u1',
    language: 'it',
    cefr: 'B1',
    titlePt: 'Imperfetto, Pronomes CI / NE e Conversas Reais',
    descriptionPt: 'Narre memórias diferenciando Imperfetto e Passato Prossimo e use os pronomes CI e NE igual a um italiano.',
    culturalNotePt: 'Italianos falam "Ci penso io!" (Deixa comigo!) e "Ne voglio ancora!" (Quero mais disso!) o tempo todo!',
    grammarFocusPt: 'Imperfetto vs Passato Prossimo · Pronomes CI e NE · Viagens',
    lessons: [
      {
        id: 'it-b1-u1-l1',
        titlePt: 'CI e NE: Os Pronomes Mais Italianos do Idioma',
        subtitlePt: 'Ci vediamo! · Ne vale la pena!',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Um amigo pergunta se vale a pena visitar Florença. Como responder como um nativo?',
          targetText: 'Assolutamente sì, ne vale davvero la pena!',
          ipa: 'A-so-lu-ta-MÊN-te sí, ne VÁ-le dav-VÉ-ro la PÊ-na!',
          translationPt: 'Com certeza sim, vale muito a pena!',
          tipPt: '"Ne vale la pena" usa NE para retomar o assunto ("disso vale a pena")!',
          options: [
            { id: 'a', text: 'Assolutamente sì, ne vale davvero la pena!' },
            { id: 'b', text: 'Sì, ci vale la pena di guardare.' },
            { id: 'c', text: 'Sì, ha pena visitare.' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte: "Não se preocupe, deixa comigo!":',
          targetText: 'Non ti preoccupare, ci penso io!',
          ipa: 'Nôn ti pre-o-cu-PÁ-re, tchi PÊN-so Í-o!',
          translationPt: 'Não se preocupe, eu cuido disso!',
          tipPt: '"Ci penso io!" é uma das expressões mais calorosas e úteis da Itália.',
          tokens: ['Non', 'ti', 'preoccupare,', 'ci', 'penso', 'io!'],
          distractors: ['ne'],
        },
        speak: {
          promptPt: 'Combine um encontro em voz alta:',
          targetText: 'Ci vediamo domani alle sei in piazza!',
          ipa: 'Tchi ve-DIÁ-mo do-MÁ-ni ÁL-le séi in PIÁ-tsa!',
          translationPt: 'Nos vemos amanhã às seis na praça!',
          tipPt: 'Em italiano, "zz" de "piazza" tem som forte de TS (PIÁ-tsa).',
        },
      },
    ],
  },
  {
    id: 'it-b2-u1',
    language: 'it',
    cefr: 'B2',
    titlePt: 'Congiuntivo, Trabalho & Diplomacia Italiana',
    descriptionPt: 'Use o Congiuntivo em opiniões (Penso che sia...) e conduza conversas profissionais com elegância italiana.',
    culturalNotePt: 'Na Itália, acertar o Congiuntivo ("Penso che sia giusto" em vez de "Penso che è giusto") é o cartão de visitas de quem domina o idioma com seriedade.',
    grammarFocusPt: 'Congiuntivo Presente e Imperfetto · Período Hipotético · Trabalho',
    lessons: [
      {
        id: 'it-b2-u1-l1',
        titlePt: 'Opiniões com Congiuntivo e Hipóteses',
        subtitlePt: 'Penso che sia... · Se avessi tempo...',
        focusSkill: 'writing',
        choice: {
          type: 'trap_buster',
          promptPt: 'Qual frase expressa corretamente "Acho que esta seja a melhor solução"?',
          targetText: 'Penso che questa sia la soluzione migliore.',
          ipa: 'PÊN-so ke CUÉS-ta SÍ-a la so-lu-TSIÔ-ne mi-LHIÔ-re.',
          translationPt: 'Acho que esta seja a melhor solução.',
          tipPt: 'Depois de "Penso che", "Credo che" e "Spero che", o italiano formal/B2 pede Congiuntivo ("sia", "abbia", "possa")!',
          options: [
            { id: 'a', text: 'Penso che questa è la soluzione più migliore.' },
            { id: 'b', text: 'Penso che questa sia la soluzione migliore.' },
            { id: 'c', text: 'Penso questa essere migliore soluzione.' },
          ],
          correctOptionId: 'b',
        },
        build: {
          promptPt: 'Monte a hipótese: "Se tivéssemos mais tempo, veríamos tudo":',
          targetText: 'Se avessimo più tempo, vedremmo tutto con calma.',
          ipa: 'Se a-VÉS-si-mo piú TÊM-po, ve-DRÊM-mo TÚT-to con CÁL-ma.',
          translationPt: 'Se tivéssemos mais tempo, veríamos tudo com calma.',
          tipPt: 'Se + Congiuntivo Imperfetto (avessimo), Condizionale (vedremmo)!',
          tokens: ['Se', 'avessimo', 'più', 'tempo,', 'vedremmo', 'tutto', 'con', 'calma.'],
          distractors: ['avremmo'],
        },
        speak: {
          promptPt: 'Fale em voz alta alinhando um projeto:',
          targetText: 'Sarebbe opportuno rivedere il piano insieme.',
          ipa: 'Sa-RÉB-be o-por-TÚ-no ri-ve-DÊ-re il PIÁ-no in-SIÉ-me.',
          translationPt: 'Seria oportuno revisar o plano juntos.',
          tipPt: 'Condicional ("Sarebbe...") suaviza sugestões profissionais com classe.',
        },
      },
    ],
  },
  {
    id: 'it-c1-u1',
    language: 'it',
    cefr: 'C1',
    titlePt: 'Conectores Cultos, Nuances e Italiano Executivo',
    descriptionPt: 'Argumente com sofisticação usando "nonostante", "tuttavia", "purché" e vocabulário preciso de negócios e cultura.',
    culturalNotePt: 'Conectores como "tuttavia" (todavia) e "nonostante ciò" (apesar disso) deixam seu discurso italiano articulado e convincente.',
    grammarFocusPt: 'Nonostante + Congiuntivo · Tuttavia · Purché · Precisão C1',
    lessons: [
      {
        id: 'it-c1-u1-l1',
        titlePt: 'Argumentação Elegante no Nível C1',
        subtitlePt: 'Nonostante · Tuttavia · Purché',
        focusSkill: 'reading',
        choice: {
          promptPt: 'Qual frase usa "nonostante" (apesar de) perfeitamente no nível C1?',
          targetText: 'Nonostante ci siano ostacoli, il progetto procede bene.',
          ipa: 'No-nos-TÁN-te tchi SÍ-a-no os-TÁ-co-li, il pro-DJÉT-to pro-TCHÉ-de BÉ-ne.',
          translationPt: 'Apesar de haver obstáculos, o projeto avança bem.',
          tipPt: '"Nonostante" seguido de verbo sempre pede Congiuntivo ("ci siano")!',
          options: [
            { id: 'a', text: 'Nonostante ci siano ostacoli, il progetto procede bene.' },
            { id: 'b', text: 'Nonostante ci sono ostacoli, ma procede bene.' },
            { id: 'c', text: 'Perché ci siano ostacoli, procede bene.' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte com "tuttavia":',
          targetText: 'La sfida è grande, tuttavia siamo pronti ad affrontarla.',
          ipa: 'La SFÍ-da é GRÁN-de, tut-ta-VÍ-a SIÁ-mo PRÔN-ti ad a-fron-TÁR-la.',
          translationPt: 'O desafio é grande; todavia, estamos prontos para enfrentá-lo.',
          tipPt: '"Affrontarla" junta o verbo "affrontare" + pronome "la" (enfrentá-la).',
          tokens: ['La', 'sfida', 'è', 'grande,', 'tuttavia', 'siamo', 'pronti', 'ad', 'affrontarla.'],
          distractors: ['ma'],
        },
        speak: {
          promptPt: 'Fale em voz alta impondo uma condição elegante ("desde que"):',
          targetText: 'Accettiamo la proposta, purché resti chiara la scadenza.',
          ipa: 'A-tche-TIÁ-mo la pro-PÓS-ta, pur-KÊ RÉS-ti KIÁ-ra la sca-DÊN-tsa.',
          translationPt: 'Aceitamos a proposta, desde que o prazo permaneça claro.',
          tipPt: '"Purché" = desde que / contanto que (+ Congiuntivo).',
        },
      },
    ],
  },
  {
    id: 'it-c2-u1',
    language: 'it',
    cefr: 'C2',
    titlePt: 'Maestria Nativa: Modi di Dire, Musicalidade & Fluência',
    descriptionPt: 'Fale com a musicalidade, os gestos verbais e os provérbios autênticos de um falante nativo italiano.',
    culturalNotePt: 'Expressões como "in bocca al lupo" (boa sorte — responde-se "crepi il lupo!" ou "viva il lupo!") fazem parte da alma da língua italiana.',
    grammarFocusPt: 'Modi di dire · Prosódia italiana · Fluência Nativa C2',
    lessons: [
      {
        id: 'it-c2-u1-l1',
        titlePt: 'Expressões Culturais & Fluência Nativa C2',
        subtitlePt: 'Falar e pensar com alma italiana',
        focusSkill: 'speaking',
        choice: {
          promptPt: 'Qual provérbio italiano significa "Quem vai devagar vai saudável e chega longe"?',
          targetText: 'Chi va piano, va sano e va lontano.',
          ipa: 'Ki vá PIÁ-no, vá SÁ-no ê vá lon-TÁ-no.',
          translationPt: 'Quem vai com calma, vai com saúde e chega longe.',
          tipPt: 'Um dos provérbios mais icônicos da Itália — perfeito para estudar no seu ritmo!',
          options: [
            { id: 'a', text: 'Chi va piano, va sano e va lontano.' },
            { id: 'b', text: 'In bocca al lupo per domani.' },
            { id: 'c', text: 'Non vedo l’ora di partire.' },
          ],
          correctOptionId: 'a',
        },
        build: {
          promptPt: 'Monte a frase de maestria C2:',
          targetText: 'Finalmente riesco a pensare ed esprimermi liberamente in italiano.',
          ipa: 'Fi-nal-MÊN-te ri-ÉS-co a pen-SÁ-re ed es-PRÍ-mer-mi li-be-ra-MÊN-te in i-ta-LIÁ-no.',
          translationPt: 'Finalmente consigo pensar e me expressar livremente em italiano.',
          tipPt: '"Riuscire a..." = conseguir / dar conta de fazer algo.',
          tokens: ['Finalmente', 'riesco', 'a', 'pensare', 'ed', 'esprimermi', 'liberamente', 'in', 'italiano.'],
          distractors: ['posso a'],
        },
        speak: {
          promptPt: 'Fale o provérbio italiano em voz alta com musicalidade nativa:',
          targetText: 'Chi va piano, va sano e va lontano.',
          ipa: 'Ki vá PIÁ-no, vá SÁ-no ê vá lon-TÁ-no.',
          translationPt: 'Quem vai com calma, vai com saúde e vai longe.',
          tipPt: 'Abra bem as vogais e saboreie a melodia do italiano C2!',
        },
      },
    ],
  },
]);
