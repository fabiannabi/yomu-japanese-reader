import { tokenizeRaw } from "./tokenizer.ts";
import { kataToHira } from "./kana.ts";

/**
 * Explicación gramatical LOCAL (offline, gratis): desglosa una oración en sus
 * piezas y describe el papel de cada una en español, usando el análisis
 * morfológico de kuromoji. No requiere API ni conexión.
 */

export interface GrammarSegment {
  surface: string;
  reading: string; // hiragana (vacío si no aplica)
  role: string; // función gramatical en español
}

// Partículas (助詞) por superficie.
const PARTICLES: Record<string, string> = {
  は: "tema de la oración (lo que se comenta)",
  が: "sujeto",
  を: "objeto directo",
  に: "destino, lugar o momento (a, en)",
  へ: "dirección (hacia)",
  で: "lugar de la acción o medio (en, con)",
  と: "y / con / cita (“que”)",
  も: "también",
  の: "posesivo o conexión (de)",
  か: "marca de pregunta",
  から: "desde / porque",
  まで: "hasta",
  より: "que (comparación) / desde",
  や: "y (lista incompleta)",
  ね: "busca confirmación (¿verdad?)",
  よ: "énfasis / aviso",
  な: "prohibición o énfasis",
  など: "etcétera",
  だけ: "solo",
  しか: "solo (con verbo negativo)",
  ばかり: "nada más / solo",
  くらい: "aproximadamente",
  ほど: "tanto como",
  でも: "incluso / o algo así",
  ので: "porque (causa)",
  のに: "aunque (contraste)",
  けど: "pero",
  けれど: "pero",
  けれども: "pero",
  し: "y además",
  ば: "si (condición)",
  たり: "entre otras acciones",
};

// Verbos auxiliares (助動詞) por forma de diccionario.
const AUX: Record<string, string> = {
  た: "marca de pasado",
  だ: "cópula (es / son)",
  です: "cópula cortés (es / son)",
  ます: "cortesía (presente)",
  ん: "negación (coloquial)",
  ない: "negación (no)",
  ぬ: "negación (clásica)",
  たい: "deseo (querer)",
  れる: "pasiva o potencial",
  られる: "pasiva, potencial o respeto",
  せる: "causativo (hacer que)",
  させる: "causativo (hacer que)",
  う: "volitivo (vamos a / haré)",
  よう: "volitivo (vamos a / haré)",
  らしい: "parece que (por lo que se oye)",
  そう: "parece / se dice que",
  ようだ: "parece que",
  まい: "negación volitiva (no haré)",
};

const NOUN_DETAIL: Record<string, string> = {
  代名詞: "pronombre",
  数: "número",
  固有名詞: "nombre propio",
  サ変接続: "sustantivo (puede formar verbo con する)",
  副詞可能: "sustantivo (puede usarse como adverbio)",
};

const CONJ_FORM: Record<string, string> = {
  連用形: "forma conectiva (base de ます)",
  連用タ接続: "forma que conecta con た/て",
  連用テ接続: "forma て",
  未然形: "forma base (negativo/volitivo)",
  仮定形: "forma condicional (si…)",
  命令ｅ: "imperativo (orden)",
  体言接続: "forma que modifica a un sustantivo",
  連体形: "forma que modifica a un sustantivo",
};

function conjNote(form: string): string {
  if (!form || form === "*" || form === "基本形") return "";
  const m = CONJ_FORM[form];
  return m ? ` · ${m}` : "";
}

function describe(f: {
  pos: string;
  pos_detail_1: string;
  conjugated_form: string;
  basic_form: string;
  surface_form: string;
}): string | null {
  const base = f.basic_form && f.basic_form !== "*" ? f.basic_form : f.surface_form;
  const lemma = base !== f.surface_form ? ` (de 「${base}」)` : "";

  switch (f.pos) {
    case "助詞":
      if (f.pos_detail_1 === "接続助詞") return "partícula que une cláusulas";
      return PARTICLES[f.surface_form] ?? "partícula";
    case "助動詞":
      return AUX[base] ?? AUX[f.surface_form] ?? "verbo auxiliar";
    case "動詞":
      return `verbo${lemma}${conjNote(f.conjugated_form)}`;
    case "形容詞":
      return `adjetivo-i${lemma}${conjNote(f.conjugated_form)}`;
    case "名詞":
      return NOUN_DETAIL[f.pos_detail_1] ?? "sustantivo";
    case "副詞":
      return "adverbio";
    case "連体詞":
      return "adnominal (modifica a un sustantivo)";
    case "接続詞":
      return "conjunción";
    case "感動詞":
      return "interjección";
    case "接頭詞":
      return "prefijo";
    case "フィラー":
      return "muletilla";
    case "記号":
      return null; // signos de puntuación: se omiten
    default:
      return f.pos;
  }
}

/** Desglosa una oración en segmentos con su función gramatical (local, offline). */
export async function analyzeGrammar(sentence: string): Promise<GrammarSegment[]> {
  const tokens = await tokenizeRaw(sentence);
  const out: GrammarSegment[] = [];
  for (const f of tokens) {
    const role = describe(f);
    if (!role) continue;
    out.push({
      surface: f.surface_form,
      reading:
        f.reading && f.reading !== "*" ? kataToHira(f.reading) : "",
      role,
    });
  }
  return out;
}
