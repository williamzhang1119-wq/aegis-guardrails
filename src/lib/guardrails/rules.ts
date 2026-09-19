import type { Pattern } from "./scoring";
import type { GuardAction, HarmCategory } from "./types";

export interface CategoryRule {
  id: HarmCategory;
  /** Topic signals. Nothing scores unless at least one of these fires. */
  triggers: Pattern[];
  /** Signals that the request is operational rather than curious. */
  intensifiers?: Pattern[];
  /** Credible benign context that should pull the score back down. */
  mitigators?: Pattern[];
  /** Action taken once the score clears the policy threshold. */
  action: GuardAction;
  /** Phases this rule runs in. Most run in both. */
  phases?: ("input" | "output")[];
}

/**
 * Shared operational-intent markers. These are what separate "how does
 * ransomware spread" from "write me working ransomware".
 */
const OPERATIONAL: Pattern[] = [
  {
    label: "Asks for step-by-step instructions",
    re: /\b(step[-\s]?by[-\s]?step|detailed instructions?|exact (?:steps|recipe|amounts?|quantities|ratios)|walk me through|full (?:recipe|procedure|process))\b/i,
    weight: 0.25,
  },
  {
    label: "Asks for production-ready output",
    re: /\b(give me (?:the )?(?:code|script|recipe|payload)|write (?:me )?(?:a|the) (?:script|program|payload|exploit)|full working|ready[-\s]to[-\s]use|complete (?:code|script|implementation))\b/i,
    weight: 0.25,
  },
  {
    label: "Wants to evade detection or accountability",
    re: /\b(undetect(?:ed|able)|without getting caught|avoid detection|evade (?:detection|antivirus|police|law enforcement)|untraceable|cover my tracks|no one (?:finds out|knows)|leave no (?:trace|evidence))\b/i,
    weight: 0.3,
  },
  {
    label: "First-person intent to act",
    re: /\b(how (?:do|can) i (?:make|build|synthesize|synthesise|create|cook|produce|obtain)|i (?:want|need) to (?:make|build|synthesize|synthesise|kill|hurt|hack|steal))\b/i,
    weight: 0.2,
  },
];

/**
 * Shared benign-context markers. Without these the classifier would refuse a
 * huge amount of legitimate research, journalism, and defensive work.
 */
const BENIGN_CONTEXT: Pattern[] = [
  {
    label: "Defensive or protective framing",
    re: /\b(how (?:do|can) (?:i|we) (?:protect|defend|prevent|secure|harden|detect)|how to (?:prevent|avoid|spot|recognise|recognize|report|mitigate)|warning signs?|red flags?|stay safe|keep (?:my|our) .{0,20}safe)\b/i,
    weight: 0.45,
  },
  {
    label: "Academic or journalistic framing",
    re: /\b(for (?:my|a|an) (?:\w+\s){0,2}(?:class|course|thesis|dissertation|essay|research|paper|homework|assignment|lecture|seminar)|history of|historical|statistics (?:on|about)|documentary|news (?:article|report)|academic|literature review|peer[-\s]reviewed)\b/i,
    weight: 0.4,
  },
  {
    label: "Policy, legal, or ethical framing",
    re: /\b(is (?:it|this|that) (?:legal|illegal|allowed|permitted)|legislation|regulat(?:ion|ory)|public policy|ethic(?:s|al)|treaty|convention|why is .{0,40}(?:dangerous|illegal|harmful|banned))\b/i,
    weight: 0.35,
  },
  {
    label: "Conceptual explanation request",
    re: /\b(what (?:is|are|does)|how does .{0,40}(?:work|spread|affect)|explain (?:the )?(?:risks?|dangers?|concept|difference|how|why|what)|difference between|in general terms|high[-\s]level|conceptual(?:ly)?)\b/i,
    weight: 0.3,
  },
  {
    label: "Clearly fictional framing",
    re: /\b(in (?:my|a) (?:novel|story|screenplay|film|game|campaign)|fiction(?:al)?|writing a (?:thriller|mystery|novel)|for a (?:video ?game|board game|d&d|tabletop))\b/i,
    weight: 0.3,
  },
];

const AUTHORIZED_SECURITY: Pattern[] = [
  {
    label: "Authorised security testing",
    re: /\b(ctf|capture the flag|bug bounty|hack ?the ?box|tryhackme|my own (?:lab|server|network|machine|vm)|homelab|authoris(?:ed|ation)|authoriz(?:ed|ation)|written permission|scope of (?:the )?engagement|pentest(?:ing)? (?:my|our)|red team exercise)\b/i,
    weight: 0.5,
  },
  {
    label: "Blue-team or remediation framing",
    re: /\b(blue team|incident response|threat (?:hunting|intel)|detection rule|sigma rule|yara|patch(?:ing)?|remediat(?:e|ion)|harden(?:ing)?|siem|soc analyst|vulnerability management|responsible disclosure)\b/i,
    weight: 0.5,
  },
];

/**
 * Output-phase delivery signals.
 *
 * On the way in, a topic trigger plus intent is enough to act. On the way out
 * the question is different: naming a harmful topic is not the same as handing
 * over the means to do it. An assistant explaining how ransomware spreads, or
 * describing how it handles self-harm, must not be blocked for using the words.
 * These patterns are what distinguish discussing a subject from delivering it.
 */
export const DELIVERY_SIGNALS: Pattern[] = [
  {
    label: "Sequenced instructions",
    re: /\b(step[-\s]?by[-\s]?step|first(?:,| you'?ll| you)|then you'?ll|next,? you|finally,? you)\b/i,
    weight: 0.3,
  },
  {
    label: "Hands over a recipe or payload",
    re: /\b(here (?:is|are) (?:the |your |a )?(?:full |complete |working )?(?:recipe|code|payload|exploit|script|procedure|steps)|full (?:recipe|code|working)|as follows:)\b/i,
    weight: 0.35,
  },
  {
    label: "Specific quantities or reagents",
    re: /\b\d+(?:\.\d+)?\s?(?:g|mg|kg|ml|mol|grams?|millilit(?:re|er)s?)\b/i,
    weight: 0.3,
  },
  {
    label: "Laboratory or synthesis imperatives",
    re: /\b(mix|combine|heat|distil|distill|reflux|dissolve|precipitate|titrate|add)\b.{0,40}\b(solution|acid|base|precursor|reagent|mixture|powder|solvent|catalyst)\b/i,
    weight: 0.4,
  },
  {
    label: "Executable offensive payload",
    re: /```[\s\S]{0,600}?\b(socket\.socket|subprocess|VirtualAlloc|CreateRemoteThread|os\.system|AES\.new|paramiko|scapy|pynput|keyboard\.Listener)\b/i,
    weight: 0.45,
  },
];

/**
 * Output-phase mitigators. A response that is refusing, or that is explaining
 * the safety system itself, is doing the right thing by mentioning the topic.
 */
export const OUTPUT_META: Pattern[] = [
  {
    label: "Refusing or withholding",
    re: /\b(i (?:can'?t|won'?t|will not|am not able to)|i'?m not (?:going to|able to)|i have to decline|not something i can help with)\b/i,
    weight: 0.5,
  },
  {
    label: "Explaining the safety system",
    re: /\b(guardrail|threshold|classifier|detector|the pipeline|safety (?:category|categories|policy)|audit log|redact(?:ion|ed)?|quarantin)\b/i,
    weight: 0.4,
  },
  {
    label: "Defensive or protective guidance",
    re: /\b(detect(?:ion)?|mitigat|prevent|protect|harm reduction|report it to|warning signs?|incident response)\b/i,
    weight: 0.3,
  },
];

/** How much a bare topic mention counts for on the output side. */
export const MENTION_ONLY_FACTOR = 0.35;

export const CATEGORY_RULES: CategoryRule[] = [
  {
    id: "csae",
    action: "block",
    triggers: [
      {
        label: "Minor referenced near sexual content",
        re: /\b(child(?:ren)?|minor|underage|pre[-\s]?teen|toddler|infant|little (?:boy|girl)|\d{1,2}[-\s]?(?:yo|year[-\s]?old))\b[\s\S]{0,40}\b(sexual|sexy|nude|naked|porn|erotic|molest|fondl|aroused|intercourse|explicit)\b/i,
        weight: 1,
      },
      {
        label: "Sexual content referenced near a minor",
        re: /\b(sexual|sexy|nude|naked|porn|erotic|molest|fondl|aroused|intercourse|explicit)\b[\s\S]{0,40}\b(child(?:ren)?|minor|underage|pre[-\s]?teen|toddler|infant|little (?:boy|girl)|\d{1,2}[-\s]?(?:yo|year[-\s]?old))\b/i,
        weight: 1,
      },
      {
        label: "Grooming or exploitation intent",
        re: /\b(groom(?:ing)? (?:a|my|the) (?:child|kid|minor|teen)|csam|child (?:porn|abuse material))\b/i,
        weight: 1,
      },
    ],
    // Narrow and deliberate: protective, educational, and reporting contexts
    // must not be swept up by a zero-tolerance rule.
    mitigators: [
      {
        label: "Child protection or education context",
        re: /\b(sex education|age[-\s]appropriate|child (?:protection|safeguarding|safety)|abuse prevention|mandated report(?:er|ing)|report (?:it |this )?to (?:the )?(?:police|ncmec|authorities)|grooming (?:warning signs?|red flags?)|talk to my (?:kid|child|son|daughter) about|survivor support|therap(?:y|ist)|social worker|teacher training)\b/i,
        weight: 0.95,
      },
    ],
  },
  {
    id: "self_harm",
    action: "safe_complete",
    triggers: [
      {
        label: "Suicidal or self-injury statement",
        re: /\b(kill(?:ing)? myself|end(?:ing)? my life|take my own life|commit(?:ting)? suicide|suicid(?:e|al)|self[-\s]?harm|cut(?:ting)? myself|hang myself|want to die|don'?t want to (?:live|be here|wake up)|no reason to live|better off dead|end it all)\b/i,
        weight: 0.6,
      },
      {
        label: "Seeking a method or lethality information",
        re: /\b(painless way|lethal dose|how (?:much|many) .{0,30}(?:to die|would kill)|quickest way to die|most effective method|how to (?:overdose|kill myself))\b/i,
        weight: 0.5,
      },
      {
        label: "Hopelessness language",
        re: /\b(nothing matters anymore|can'?t go on|i'?m a burden|everyone would be happier|tired of (?:living|existing))\b/i,
        weight: 0.4,
      },
    ],
    intensifiers: [
      {
        label: "Immediate timeframe",
        re: /\b(tonight|right now|today|this (?:evening|weekend)|already (?:have|took)|i'?ve decided)\b/i,
        weight: 0.25,
      },
    ],
    mitigators: [
      {
        label: "Research or statistics framing",
        re: /\b(statistics (?:on|about)|prevalence|epidemiolog|research (?:on|about)|public health|screening tool|clinical (?:study|trial)|policy brief)\b/i,
        weight: 0.35,
      },
    ],
  },
  {
    id: "weapons_mass_harm",
    action: "block",
    triggers: [
      {
        label: "Chemical or biological agent",
        re: /\b(nerve agent|sarin|vx gas|novichok|mustard gas|ricin|botulinum|anthrax|weaponi[sz]e[d]? (?:virus|pathogen|anthrax|smallpox)|bioweapon|biological weapon|chemical weapon|nerve gas|chlorine gas at home)\b/i,
        weight: 0.7,
      },
      {
        label: "Nuclear or radiological",
        re: /\b(dirty bomb|radiological dispersal|enrich(?:ing|ed)? uranium|weapons[-\s]grade (?:uranium|plutonium)|nuclear (?:device|warhead) (?:design|build))\b/i,
        weight: 0.7,
      },
      {
        label: "Explosive device construction",
        re: /\b(pipe bomb|improvised explosive|\bied\b|tatp|anfo|c-?4 (?:charge|explosive)|detonator (?:circuit|build)|shrapnel (?:load|packing)|build (?:a )?(?:bomb|explosive))\b/i,
        weight: 0.7,
      },
    ],
    intensifiers: OPERATIONAL,
    mitigators: [
      ...BENIGN_CONTEXT,
      {
        label: "Medical or defensive response context",
        re: /\b(symptoms of|treatment for|antidote|decontaminat|first responder|geneva|non[-\s]proliferation|disarmament|inspectors?|detection equipment|civil defen[cs]e)\b/i,
        weight: 0.5,
      },
    ],
  },
  {
    id: "violence_threat",
    action: "block",
    triggers: [
      {
        label: "Threat against an identifiable person",
        re: /\b(kill (?:him|her|them|my (?:boss|neighbour|neighbor|ex|teacher|coworker|co-worker|roommate|wife|husband))|murder (?:him|her|them|someone|my)|assassinate|stab (?:him|her|them)|beat (?:him|her|them) up|make (?:him|her|them) suffer|hurt (?:him|her|them) badly)\b/i,
        weight: 0.6,
      },
      {
        label: "Mass violence planning",
        re: /\b(shoot up (?:a|my|the) (?:school|office|mall|church)|mass shooting plan|attack (?:a|the) (?:crowd|concert|parade))\b/i,
        weight: 0.8,
      },
      {
        label: "Concealment of violence",
        re: /\b(dispose of (?:a|the) body|make it look like an accident|fake an alibi|untraceable poison)\b/i,
        weight: 0.7,
      },
    ],
    intensifiers: OPERATIONAL,
    mitigators: [
      ...BENIGN_CONTEXT,
      {
        label: "Self-defence or de-escalation framing",
        re: /\b(self[-\s]defen[cs]e|de[-\s]escalat|restraining order|martial arts class|krav maga|report (?:the )?threat|safety plan)\b/i,
        weight: 0.4,
      },
    ],
  },
  {
    id: "cyber_intrusion",
    action: "block",
    triggers: [
      {
        label: "Malware or intrusion tooling",
        re: /\b(ransomware|keylogger|botnet|rootkit|remote access trojan|\brat\b payload|credential stealer|infostealer|reverse shell|meterpreter payload|c2 (?:server|beacon)|wiper malware|crypto ?locker)\b/i,
        weight: 0.6,
      },
      {
        label: "Unauthorised access attempt",
        re: /\b(hack (?:into )?(?:someone|somebody|my ex|his|her|their|the (?:school|company|bank))|break into (?:his|her|their|someone'?s) (?:account|phone|email|computer)|crack (?:the |a |his |her )?password|brute[-\s]?force (?:the )?login|bypass (?:2fa|mfa|two[-\s]factor|authentication)|steal (?:session )?cookies|session hijack)\b/i,
        weight: 0.6,
      },
      {
        label: "Exploit development",
        re: /\b(zero[-\s]?day|0day|working exploit|exploit for cve|weaponi[sz]e[d]? (?:exploit|vulnerability)|privilege escalation exploit|sql injection payload|shellcode)\b/i,
        weight: 0.5,
      },
      {
        label: "Availability attack",
        re: /\b(ddos|denial[-\s]of[-\s]service attack|deauth attack|sim ?swap|amplification attack)\b/i,
        weight: 0.5,
      },
    ],
    intensifiers: [
      ...OPERATIONAL,
      {
        label: "Explicitly wants antivirus evasion",
        re: /\b(evade (?:av|antivirus|edr|defender)|obfuscat(?:e|ed) (?:payload|code)|fud|fully undetectable|bypass (?:av|edr|sandbox))\b/i,
        weight: 0.35,
      },
    ],
    mitigators: [...BENIGN_CONTEXT, ...AUTHORIZED_SECURITY],
  },
  {
    id: "illicit_drugs",
    action: "block",
    triggers: [
      {
        label: "Drug synthesis or production",
        re: /\b(synthesi[sz]e (?:meth|methamphetamine|mdma|fentanyl|lsd|cocaine|heroin)|cook (?:meth|methamphetamine)|meth lab|pill press|precursor chemicals?|extract dmt|grow (?:psilocybin|shrooms)|acetylat(?:e|ion) (?:morphine|heroin))\b/i,
        weight: 0.7,
      },
      {
        label: "Trafficking or distribution logistics",
        re: /\b(cut (?:cocaine|heroin) with|darknet market|dead ?drop|traffick(?:ing)? (?:drugs|narcotics)|smuggle (?:drugs|pills)|launder drug (?:money|profits)|sell (?:pills|drugs) (?:online|at school))\b/i,
        weight: 0.6,
      },
    ],
    intensifiers: OPERATIONAL,
    mitigators: [
      ...BENIGN_CONTEXT,
      {
        label: "Harm reduction or treatment framing",
        re: /\b(harm reduction|test(?:ing)? kit|reagent test|naloxone|narcan|overdose (?:response|risk)|addiction|recovery|rehab|treatment|withdrawal|decriminali[sz]|pharmacolog|how does .{0,30}affect the brain)\b/i,
        weight: 0.55,
      },
    ],
  },
  {
    id: "hate_harassment",
    action: "block",
    triggers: [
      {
        label: "Dehumanising generalisation",
        re: /\b(all (?:jews|muslims|christians|black people|white people|asians|latinos|immigrants|women|men|gay people|trans people|disabled people) are\b|subhuman|vermin|inferior race|racial purity|deserve to (?:die|suffer)|should be (?:exterminated|eradicated|wiped out|deported en masse))\b/i,
        weight: 0.65,
      },
      {
        label: "Request to generate demeaning content about a group",
        re: /\bwrite (?:me )?(?:a )?(?:joke|jokes|insult|rant|poem|song|slogan) (?:about|mocking|degrading|making fun of) .{0,40}\b(?:jews|muslims|black people|asians|women|men|gay|lesbian|trans|disabled|immigrants|refugees)\b/i,
        weight: 0.6,
      },
      {
        label: "Targeted harassment campaign",
        re: /\b(harass|humiliate|dox|brigade|bully|pile on) (?:him|her|them|this (?:person|user)|my (?:ex|coworker|classmate|teacher))\b/i,
        weight: 0.6,
      },
    ],
    intensifiers: OPERATIONAL,
    mitigators: [
      ...BENIGN_CONTEXT,
      {
        label: "Counter-speech or moderation framing",
        re: /\b(counter[-\s]speech|content moderation|classifier|training data for detection|combat(?:ting)? (?:hate|racism)|anti[-\s](?:racism|semitism)|bias audit|quoted from|analy[sz]e (?:this|the) (?:post|comment)|why (?:is|was) .{0,30}offensive)\b/i,
        weight: 0.5,
      },
    ],
  },
  {
    id: "extremism",
    action: "block",
    triggers: [
      {
        label: "Support for or recruitment into violent extremism",
        re: /\b(join (?:isis|isil|daesh|al[-\s]?qaeda|the taliban|a terrorist)|recruit(?:ment|ing) (?:material|pitch|for the cause)|write (?:a |my )?manifesto|glorif(?:y|ies|ying) (?:the )?(?:attack|shooter|bomber)|jihad against|race war|accelerationis(?:m|t)|lone wolf attack)\b/i,
        weight: 0.65,
      },
    ],
    intensifiers: OPERATIONAL,
    mitigators: [
      ...BENIGN_CONTEXT,
      {
        label: "Counter-terrorism or deradicalisation framing",
        re: /\b(deradicali[sz]|counter[-\s]?(?:terrorism|extremism)|prevent(?:ing)? radicali[sz]ation|threat assessment|intelligence analysis|journalis(?:m|t)|case study)\b/i,
        weight: 0.5,
      },
    ],
  },
  {
    id: "fraud_deception",
    action: "block",
    triggers: [
      {
        label: "Phishing or social-engineering asset",
        re: /\b(phishing (?:email|page|kit|site)|clone (?:a |the )?login page|credential harvest|spoof (?:the )?sender|smishing|vishing script|pretext(?:ing)? call script|fake (?:invoice|receipt|refund) (?:email|template))\b/i,
        weight: 0.6,
      },
      {
        label: "Financial fraud or forgery",
        re: /\b(money launder|carding|stolen credit card|forge (?:a |an )?(?:passport|id|driver'?s licen[cs]e|diploma|signature|cheque|check)|counterfeit (?:money|bills|documents)|identity theft|romance scam|advance[-\s]fee|ponzi scheme setup)\b/i,
        weight: 0.6,
      },
      {
        label: "Deceptive influence at scale",
        re: /\b(fake reviews?(?: at scale)?|bot farm|sockpuppet accounts?|astroturf|vote manipulation|impersonate (?:a |the )?(?:ceo|bank|government|official))\b/i,
        weight: 0.55,
      },
    ],
    intensifiers: OPERATIONAL,
    mitigators: [
      ...BENIGN_CONTEXT,
      ...AUTHORIZED_SECURITY,
      {
        label: "Fraud prevention or compliance framing",
        re: /\b(fraud (?:detection|prevention|awareness)|anti[-\s]money[-\s]laundering|\baml\b|\bkyc\b|compliance|security awareness training|report(?:ing)? (?:the )?scam|chargeback|consumer protection)\b/i,
        weight: 0.55,
      },
    ],
  },
  {
    id: "privacy_doxxing",
    action: "block",
    triggers: [
      {
        label: "Locating or identifying a private individual",
        re: /\b(find (?:someone'?s|his|her|their|this person'?s) (?:home )?address|where does .{0,30}live|real name of (?:this|the) (?:anonymous|user|account)|identify (?:this|the) person (?:in|from) (?:the |this )?(?:photo|picture|image)|licen[cs]e plate lookup|ssn lookup|reverse[-\s]lookup (?:his|her|their) (?:number|phone))\b/i,
        weight: 0.6,
      },
      {
        label: "Covert tracking or surveillance",
        re: /\b(track (?:my|his|her|their) (?:ex|girlfriend|boyfriend|wife|husband|partner|kid'?s)? ?(?:phone|location|car)|stalkerware|spyware on (?:his|her|their) phone|read (?:his|her|their) (?:messages|texts|whatsapp)|without (?:them|him|her) knowing|secretly monitor|hidden (?:camera|tracker) in (?:his|her|their))\b/i,
        weight: 0.65,
      },
    ],
    intensifiers: OPERATIONAL,
    mitigators: [
      ...BENIGN_CONTEXT,
      {
        label: "Consent, self-service, or legal-process framing",
        re: /\b(my own (?:phone|account|device|data)|with (?:their|his|her) consent|public figure|elected official|court order|subpoena|law enforcement request|opt[-\s]out|data broker removal|delete my (?:data|information)|find my (?:own )?(?:phone|device)|parental controls with)\b/i,
        weight: 0.55,
      },
    ],
  },
  {
    id: "adult_sexual",
    action: "annotate",
    triggers: [
      {
        label: "Request for explicit sexual content",
        re: /\b(write (?:me )?(?:an? )?(?:explicit|graphic|erotic|nsfw) (?:story|scene|roleplay|fanfic)|describe (?:in )?(?:graphic|explicit) sexual detail|smut|erotica)\b/i,
        weight: 0.6,
      },
    ],
    mitigators: [
      {
        label: "Health or educational framing",
        re: /\b(sexual health|contracept|std|sti\b|consent education|anatomy|reproductive health|therapy|relationship advice)\b/i,
        weight: 0.4,
      },
    ],
  },
  {
    id: "dangerous_medical",
    action: "annotate",
    triggers: [
      {
        label: "Specific dosing or self-treatment request",
        re: /\b(how (?:much|many) (?:mg|milligrams?|pills?|ml) .{0,30}(?:should i take|can i take|to take)|double (?:my|the) dose|stop taking my (?:medication|insulin|antidepressant|blood thinner)|mix (?:alcohol|xanax|adderall|opioids?) with|self[-\s]medicat|treat (?:my|this) (?:infection|cancer|fracture) at home|diagnose (?:me|my|this))\b/i,
        weight: 0.55,
      },
    ],
    mitigators: [
      {
        label: "Already under professional care",
        re: /\b(my (?:doctor|physician|pharmacist|oncologist|therapist) (?:said|told me|prescribed|recommended)|per my prescription|discharge instructions)\b/i,
        weight: 0.3,
      },
    ],
  },
  {
    id: "regulated_advice",
    action: "annotate",
    triggers: [
      {
        label: "Legal question",
        re: /\b(should i (?:sue|plead|settle|sign)|is (?:this|my) (?:contract|lease|nda) (?:valid|enforceable)|my landlord|wrongful termination|custody|immigration status|legal advice)\b/i,
        weight: 0.5,
      },
      {
        label: "Financial or tax question",
        re: /\b(should i (?:invest|buy|sell)\b.{0,30}?(?:stocks?|crypto|shares|etf|bonds?|index fund)|tax deduction|write[- ]?off|retirement account|401\(?k\)?|mortgage rate|investment advice|is .{0,20}a good investment)\b/i,
        weight: 0.5,
      },
      {
        label: "Personal medical question",
        re: /\b(am i having a|do i have (?:cancer|covid|an infection|adhd|depression)|my symptoms are|is this rash|should i (?:see|go to) (?:a doctor|the er))\b/i,
        weight: 0.5,
      },
    ],
  },
];

/** Rules that only make sense on model output. */
export const OUTPUT_ONLY_CATEGORIES: HarmCategory[] = ["system_prompt_leak"];
