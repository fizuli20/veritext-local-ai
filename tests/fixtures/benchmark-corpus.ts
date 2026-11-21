export interface BenchmarkPassage {
  id: string;
  domain: string;
  label: 'human' | 'llm';
  title: string;
  text: string;
  wordCount: number;
  expectedCharacteristics: string[];
}

export const BENCHMARK_CORPUS: BenchmarkPassage[] = [
  // ==========================================
  // 10 HUMAN PASSAGES (High burstiness, varied cadence, authentic voice)
  // ==========================================
  {
    id: 'human-01',
    domain: 'investigative-journalism',
    label: 'human',
    title: 'Port Authority Kickback Scheme',
    text: `We spent seven months pulling municipal dock manifests out of courthouse basements across Delaware County. What emerged wasn't a clean white-collar paper trail, but dozens of damp cardboard boxes packed with carbon-copy slips, rubber-banded receipts, and signed delivery vouchers for gravel shipments that never arrived. In November 2023, harbor loggers repeatedly billed county taxpayers forty-two thousand dollars for dredge maintenance on Berth 9. The catch? Berth 9 had been decommissioned five years prior. When our reporting team confronted commissioner David Vance outside the public safety building on Wednesday, he didn't call his attorney. He didn't issue a press statement either. He pulled his trench coat tight against the sleet, stepped directly into the slush of Market Street, and slammed his sedan door without uttering a syllable. Four hours later, his administrative assistant quietly submitted an unscheduled retirement letter. Sources inside the comptroller's office confirmed federal subpoenas arrived before sunset. Sometimes fraud doesn't hide behind offshore shells; it just sits in damp cardboard boxes waiting for someone stubborn enough to flip through eighteen thousand waterlogged receipts.`,
    wordCount: 168,
    expectedCharacteristics: ['High sentence-length burstiness', 'Concrete investigative details', 'Short punchy sentences', 'Zero AI clichés'],
  },
  {
    id: 'human-02',
    domain: 'engineering-postmortem',
    label: 'human',
    title: 'Postmortem: Redis Cluster Partition and Split-Brain Incident',
    text: `At 03:14 UTC on October 12, our primary Redis cluster across us-east-1 partitioned following an unannounced transit provider fiber cut between Ashburn and Manassas. Heartbeats timed out. Sentinel quorums triggered split-brain failovers in three availability zones concurrently, dropping write throughput to zero. For forty-six agonizing minutes, customer API keys failed validation, rejecting over 4.2 million incoming webhook requests. Why did the fallback fail? Simple: our configuration management script had hardcoded a single DNS seed instead of reading the replica map dynamically. When node-04 died, node-07 assumed leadership while node-02 still accepted localized writes. We had two heads on one hydra. The recovery required manually freezing traffic at the Cloudflare edge, running a custom python salvage script to reconcile conflicting key-value offsets, and force-terminating thirty-two zombie client connections. It was messy, manual, and exhausting. We didn't lose durable database state, but customer trust took a beating. The remediation PR removes DNS seeds, mandates TLS session tickets on all internal cluster RPCs, and enforces chaos-monkey network partition tests every sprint. No more blind faith in automatic failover.`,
    wordCount: 172,
    expectedCharacteristics: ['Terse technical cadence', 'Specific metrics and timestamps', 'Dynamic sentence rhythm', 'Asymmetric technical prose'],
  },
  {
    id: 'human-03',
    domain: 'personal-narrative',
    label: 'human',
    title: 'The Orchard in Early November',
    text: `My grandfather always pruned the Northern Spy apple trees long after the leaves dropped, usually when frost rimmed the grass like crushed salt. He carried an old pair of Corona bypass loppers with hickory handles so dark with machine oil they looked like walnut. He never spoke much while working. Snip. Pause. Step back two paces. Look up through the naked grey canopy into the pale November clouds. Then another cut. I asked him once why he cut away branches that still produced sweet fruit the prior autumn. He wiped his thumb across the cutting blade and said, "Boy, if sunlight can't fly through the center of that tree like a robin, your apples will rot before you ever climb the ladder." That was it. No lecture on botany. Just thirty seconds of plain sense from a man who survived three farm depressions by knowing what to leave behind and what to throw into the brush pile. Fifty years later, standing in my own back lot with rust on my tools, I still catch myself looking for the robin.`,
    wordCount: 174,
    expectedCharacteristics: ['Poignant narrative voice', 'Sensory and concrete metaphors', 'Conversational colloquialisms', 'Varied sentence length'],
  },
  {
    id: 'human-04',
    domain: 'conversational-op-ed',
    label: 'human',
    title: 'The Great Return-to-Office Farce',
    text: `Let's be completely honest about corporate return-to-office mandates: they have almost nothing to do with serendipity in the hallway or spontaneous water-cooler breakthroughs. Have you ever had a brilliant, million-dollar commercial epiphany while waiting in line to reheat chicken in an office microwave? Of course not. Nobody has. What executives actually miss is the visceral theater of managerial control. They spent decades climbing a ladder designed around corner suites, mahogany conference tables, and subordinates visibly tapping on keyboards at 4:45 PM. When everyone went home and still shipped products ahead of schedule, that entire status architecture crumbled. Now we're subjected to patronizing memos praising corporate culture, accompanied by mandatory badges tracking whether our laptops registered on fifth-floor Wi-Fi routers for three days a week. It's performative nonsense. If your business genuinely requires physical collaboration, build workshops people want to attend. Don't force senior software architects to endure ninety minutes of gridlock just so middle management can watch them join Zoom calls from a noisy open-plan cubicle.`,
    wordCount: 165,
    expectedCharacteristics: ['Rhetorical questions', 'Informal, punchy tone', 'High lexical burstiness', 'Sarcastic realism'],
  },
  {
    id: 'human-05',
    domain: 'dense-academic',
    label: 'human',
    title: 'Topological Dynamics of Glassy Relaxation',
    text: `Structural relaxation in deeply supercooled liquids defies description via standard equilibrium statistical mechanics. As temperature drops toward the empirical glass transition point Tg, molecular rearrangement rates plummet by fourteen orders of magnitude without any discernible change in static pair-correlation functions g(r). This apparent contradiction suggests dynamic arrest is mediated by configuration-space topology rather than crystallographic nucleation. By projecting the high-dimensional potential energy landscape onto inherent structures—local minima identified via conjugate gradient minimization—we demonstrate that the accessible saddle index scales inversely with temperature fluctuations. Particles do not freeze collectively; rather, localized string-like cooperative displacements become energetically penalized as cage effects constrain nearest-neighbor permutations. At high packing fractions, entropic bottlenecks dominate. The system becomes trapped in metastates whose escape times grow exponentially, giving rise to stretched-exponential Kohlrausch-Williams-Watts decay envelopes. Consequently, treating viscosity divergence as a thermodynamic singularity obscures the underlying kinetic percolation that actually defines non-ergodic transition regimes.`,
    wordCount: 147,
    expectedCharacteristics: ['Specialized mathematical syntax', 'Dense theoretical formulations', 'Absence of generic fillers', 'Rigorous domain vocabulary'],
  },
  {
    id: 'human-06',
    domain: 'investigative-journalism',
    label: 'human',
    title: 'Wildfire Defense Contracts and Ghost Crews',
    text: `When the Caldor blaze roared toward Grizzly Flats, dispatch logs showed nine private engine strike teams assigned to ridge containment. Local volunteers on the fire line told a very different story: they saw two battered tankers and a handful of exhausted teenagers in ill-fitting Nomex suits. Where were the other seven teams? Our examination of Cal Fire billing records revealed that private contractor Sierra Wildland Logistics billed the state $185,000 per week for ghost crews—personnel listed on paper manifests whose cell phones were pinging towers in Bakersfield, two hundred miles away from the smoke. When state auditors requested GPS telemetry for the support trucks, the contractor claimed the hard drives were ruined by heat exposure. We tracked down the mechanics who serviced those vehicles. Their shop records showed the trucks had sat on flat tires in a scrap yard throughout August. Taxpayers funded phantom firefighters while mountain towns burned to the granite bedrock.`,
    wordCount: 153,
    expectedCharacteristics: ['Hard investigative evidence', 'Short dramatic breaks', 'Concrete geography', 'Natural human rhythm'],
  },
  {
    id: 'human-07',
    domain: 'engineering-postmortem',
    label: 'human',
    title: 'Memory Leak in Real-Time Video Transcoder Pipeline',
    text: `The culprit wasn't our C++ FFmpeg binding. It was a three-line Go defer block inside the websocket packet dispatcher. Under normal load, frame buffers allocated during H.265 ingestion were freed as soon as client acknowledgments returned. But when downstream cellular clients experienced packet jitter, TCP send buffers backed up. The Go runtime held references to entire 4K frame chunks inside an unbuffered channel closure, preventing garbage collection. By 18:00 on Sunday, resident set memory climbed from 4GB to 62GB, eventually triggering the Linux out-of-memory killer on our flagship gateway instance. The fix was embarrassingly straightforward: drop channel buffering altogether and switch to ring buffers with explicit reference counting. We spent four days profiling heap allocations with pprof when all we really needed was to stop trusting Go closures with raw video byte slices. The post-incident dashboard shows flat 1.8GB memory usage across seventy-two hours of sustained load.`,
    wordCount: 151,
    expectedCharacteristics: ['Direct technical postmortem', 'Self-effacing developer tone', 'Concrete technical primitives', 'Organic sentence cadence'],
  },
  {
    id: 'human-08',
    domain: 'personal-narrative',
    label: 'human',
    title: 'Night Shift at the 24-Hour Diner',
    text: `3:00 AM on a rain-slicked Tuesday in South Philly brings out a specific breed of survivor. Line cooks with burns up to their elbows, cab drivers nursing black coffee that tastes like scorched pennies, and graveyard-shift nurses trying to wash hospital antiseptic out of their senses with blueberry pancakes. I worked the griddle behind a counter that rattled every time the freight train shook the viaduct overhead. You learn people through their grease orders. The guy with the twitch in his left shoulder always wanted three eggs over-hard with burnt toast—no butter, ever. He'd sit on stool seven, pull a folded crosswords page from his coat, and tap his pen against the laminated menu until his food landed. Never left more than two quarters on the counter, but he never left less either. In a city where everything moves too fast and breaks too easily, those quarters felt like a contract.`,
    wordCount: 154,
    expectedCharacteristics: ['Sensory richness', 'Atmospheric pacing', 'Authentic vernacular', 'Irregular sentence structures'],
  },
  {
    id: 'human-09',
    domain: 'conversational-op-ed',
    label: 'human',
    title: 'Smart Fridges and the Nightmare of Connected Appliances',
    text: `Why does a toaster need a Wi-Fi connection? Seriously, can someone explain the consumer benefit of a refrigerator that stops dispensing filtered ice water because its firmware update failed over TLS 1.3? We've allowed consumer electronics manufacturers to transform durable household goods—machines that used to last twenty-five years with zero maintenance—into disposable surveillance endpoints that become electronic bricks the moment an overseas cloud server shuts down. Last month, my neighbor couldn't open his front door because his smart lock vendor suffered an AWS outage. Imagine standing on your own porch in the rain, staring at a dead deadbolt, waiting for a DevOps engineer in Seattle to restart a Kubernetes pod so you can get your groceries inside. It isn't convenience. It's an elaborate subscription trap dressed up as modern living. Give me a physical brass key and a mechanical thermostat any day of the week.`,
    wordCount: 147,
    expectedCharacteristics: ['Spicy rhetorical style', 'Relatable everyday frustrations', 'Varied sentence length', 'Contractions and idioms'],
  },
  {
    id: 'human-10',
    domain: 'dense-academic',
    label: 'human',
    title: 'Epistemic Closure in Algorithmic Feed Recommenders',
    text: `Algorithmic content dissemination engines do not merely filter information; they construct hermeneutic boundaries that systematically reshape user cognition. When stochastic gradient descent optimizes for immediate behavioral engagement—measured via dwell time, repost frequency, and interaction velocity—the objective function inevitably privileges ideologically polarized content over nuanced discourse. This occurs because emotional arousal exhibits lower cognitive friction than analytical critique. Consequently, Bayesian belief updates among networked agents become path-dependent. Rather than converging toward empirical truth, the posterior distribution collapses into insulated basins of attraction. Feedback loops between platform feature embeddings and user clickstream dynamics accelerate this drift, cementing what sociologists term epistemic closure. Mitigating this degradation requires re-evaluating core objective functions, transitioning from myopic click-maximization heuristics toward multi-objective loss landscapes that explicitly penalize echo-chamber entropy and reward cross-topical exploration.`,
    wordCount: 131,
    expectedCharacteristics: ['High scholarly density', 'Epistemic precision', 'Complex subordinate clauses', 'Original non-formulaic flow'],
  },

  // ==========================================
  // 10 RAW LLM PASSAGES (Low burstiness, formulaic openers, AI clichés, uniform cadence)
  // ==========================================
  {
    id: 'llm-01',
    domain: 'investigative-journalism',
    label: 'llm',
    title: 'The Unfolding Investigation of Municipal Oversight',
    text: `In today's fast-paced world, municipal governance plays a pivotal role in ensuring institutional integrity and transparency. It is worth noting that investigating public records requires a comprehensive overview of municipal transactions to delve into potential irregularities. Furthermore, recent audits underscore the importance of maintaining thorough documentation across all departments. The findings serve as a testament to the fact that when civic watchdogs examine financial disclosures, they foster a sense of trust within the community. Moreover, navigating the complexities of administrative records highlights the multifaceted nature of public stewardship. In addition to financial analysis, interviews with local officials shed light on the ever-evolving landscape of governance. It can be argued that such inquiries are essential for safeguarding taxpayer resources. In conclusion, the tapestry of accountability relies on vigilance, dedication, and meticulous oversight to ensure that public institutions remain steadfast in their commitment to serving the common good.`,
    wordCount: 147,
    expectedCharacteristics: ['Heavy Tier 1 clichés (pivotal role, delve into, tapestry of)', 'Uniform sentence length (~18-20 words)', 'Formulaic discourse markers (Furthermore, Moreover, In conclusion)', 'Lack of burstiness'],
  },
  {
    id: 'llm-02',
    domain: 'engineering-postmortem',
    label: 'llm',
    title: 'A Comprehensive Analysis of the Cloud Architecture Outage',
    text: `In the realm of modern cloud infrastructure, system availability plays a crucial role in maintaining business continuity. It is important to remember that unexpected network disruptions can significantly impact overall operational stability. Furthermore, when the primary caching cluster experienced an unforeseen partition, engineers were required to navigate the complexities of distributed failover protocols. Moreover, this incident serves as a stark reminder of the delicate balance between automation and manual intervention. The technical team conducted a comprehensive overview of the node topology, highlighting the multifaceted nature of distributed systems. In addition, implementing automated health checks will foster a more resilient architecture moving forward. Notably, optimizing network latency and refining quorum algorithms will underscore the importance of robust disaster recovery frameworks. In conclusion, by learning from these technical hurdles, organizations can embark on a journey toward building fault-tolerant systems in an ever-evolving digital landscape.`,
    wordCount: 147,
    expectedCharacteristics: ['Heavy AI clichés (in the realm of, crucial role, multifaceted nature, journey)', 'Formulaic openers (Furthermore, Moreover, Notably, In conclusion)', 'Symmetric syntax', 'Low burstiness'],
  },
  {
    id: 'llm-03',
    domain: 'personal-narrative',
    label: 'llm',
    title: 'Reflections on the Timeless Beauty of Nature',
    text: `In today's fast-paced society, connecting with nature offers a wonderful opportunity to reflect on life's journey. It is worth noting that spending time in an orchard allows individuals to cultivate a sense of tranquility and inner peace. Furthermore, the gentle rhythm of pruning branches serves as a poignant reminder of personal growth and transformation. Moreover, observing the delicate balance between sunlight and foliage highlights the multifaceted beauty of the natural world. Each fallen leaf tells a unique story, underscoring the importance of patience and mindful contemplation. Additionally, these serene moments foster a deep appreciation for the simpler things in life. By stepping away from modern distractions, one can delve into their thoughts and discover valuable insights. In conclusion, embracing the peaceful tapestry of rural life provides a comprehensive foundation for emotional renewal and spiritual harmony in an ever-changing world.`,
    wordCount: 142,
    expectedCharacteristics: ['Clichés (fast-paced society, journey, multifaceted beauty, tapestry, delve into)', 'Uniform sentences', 'Predictable discourse progression', 'Low entropy'],
  },
  {
    id: 'llm-04',
    domain: 'conversational-op-ed',
    label: 'llm',
    title: 'Navigating the Evolution of Remote Work Culture',
    text: `In recent years, the concept of remote work has transformed the modern workplace in profound and lasting ways. It is essential to recognize that returning to physical offices presents both unique opportunities and notable challenges for professionals. Furthermore, workplace collaboration plays a pivotal role in driving organizational innovation and employee engagement. Moreover, balancing flexibility with team cohesion requires leadership to navigate the complexities of hybrid operational models. It can be argued that open communication and mutual trust foster a sense of belonging within distributed teams. Additionally, modern organizations must implement clear policies that underscore the importance of work-life harmony and mental well-being. Ultimately, the future of work represents an ever-evolving landscape where adaptability and empathy are paramount. In conclusion, by embracing these strategic shifts, forward-thinking enterprises can cultivate an environment of sustained productivity, creativity, and shared success.`,
    wordCount: 139,
    expectedCharacteristics: ['Robotic balance-hedging', 'Formulaic transitions', 'Cliché lexicon (pivotal role, ever-evolving landscape)', 'Monotonous sentence lengths'],
  },
  {
    id: 'llm-05',
    domain: 'dense-academic',
    label: 'llm',
    title: 'A Systematic Exploration of Kinetic Dynamics in Condensed Matter',
    text: `In the realm of condensed matter physics, understanding the fundamental mechanisms governing molecular relaxation remains an area of ongoing scientific inquiry. It is worth noting that temperature fluctuations significantly influence particle mobility and structural rearrangement within disordered states. Furthermore, mathematical models must account for configurational changes to provide a comprehensive overview of thermodynamic properties. Moreover, empirical investigations underscore the importance of examining potential energy landscapes in supercooled systems. In addition to thermodynamic equilibrium, dynamical arrest highlights the multifaceted nature of non-crystalline transitions. Notably, cooperative particle interactions play a crucial role in shaping relaxation envelopes across multiple timescales. It can be argued that refining theoretical frameworks will foster a deeper understanding of molecular constraints. In conclusion, ongoing computational research continues to illuminate this ever-evolving field, offering valuable perspectives on the complex interplay between thermal energy and kinetic stability.`,
    wordCount: 141,
    expectedCharacteristics: ['Vague academic padding without real equations or data', 'Tier 1 & 2 markers (in the realm of, comprehensive overview, multifaceted nature)', 'Rule-of-three syntax', 'Low lexical diversity'],
  },
  {
    id: 'llm-06',
    domain: 'investigative-journalism',
    label: 'llm',
    title: 'Examining Public Expenditure in Disaster Relief Programs',
    text: `In today's world, the allocation of municipal relief funds plays a pivotal role in supporting vulnerable communities during unforeseen crises. It is worth noting that transparency in fiscal management is essential for maintaining democratic accountability. Furthermore, recent investigative reports underscore the importance of strict regulatory compliance across all emergency response operations. Moreover, examining financial records allows independent analysts to delve into resource distribution and identify operational discrepancies. In addition, ethical governance fosters a sense of public confidence that is vital for community resilience. Notably, tracking public expenditures highlights the multifaceted nature of disaster preparedness initiatives. It can be argued that establishing standardized reporting guidelines serves as a testament to institutional integrity. In conclusion, ensuring that taxpayer resources are utilized effectively requires ongoing dedication, strategic collaboration, and steadfast oversight in an ever-evolving public sector environment.`,
    wordCount: 135,
    expectedCharacteristics: ['Repetitive participial tails', 'Generic padding', 'Formulaic transitions', 'High cliché density'],
  },
  {
    id: 'llm-07',
    domain: 'engineering-postmortem',
    label: 'llm',
    title: 'Strategic Insights into Software Pipeline Performance and Optimization',
    text: `In the realm of modern software engineering, optimizing memory allocation plays a vital role in ensuring high-performance system execution. It is worth noting that memory leaks can compromise application reliability and degrade user satisfaction over extended periods. Furthermore, diagnosing complex runtime errors requires software architects to navigate the complexities of garbage collection mechanisms. Moreover, thorough performance profiling provides a comprehensive overview of resource utilization across concurrent background threads. In addition to code refactoring, systematic unit testing underscores the importance of software craftsmanship and system resiliency. Notably, implementing proactive monitoring solutions will foster a culture of engineering excellence across technical teams. It can be argued that continuous architectural refinement is key to sustained stability. In conclusion, by addressing these operational challenges directly, development organizations can embark on a journey toward building scalable, robust, and dependable enterprise solutions.`,
    wordCount: 141,
    expectedCharacteristics: ['Heavy clichés (realm of, vital role, navigate the complexities, embark on a journey)', 'Standard introductory and concluding formulas', 'Uniform sentence cadence'],
  },
  {
    id: 'llm-08',
    domain: 'personal-narrative',
    label: 'llm',
    title: 'The Enduring Warmth of Everyday Human Connections',
    text: `In today's fast-paced society, taking a moment to appreciate everyday interactions offers a heartwarming reminder of our shared humanity. It is worth noting that small acts of kindness play a pivotal role in brightening our daily lives. Furthermore, observing the hustle and bustle of a local gathering place allows individuals to foster a sense of belonging and community. Moreover, sharing a quiet conversation over warm coffee highlights the multifaceted beauty of ordinary moments. In addition, these gentle exchanges serve as a testament to the enduring strength of the human spirit. Notably, pausing to reflect on these subtle experiences underscores the importance of empathy, gratitude, and mindful presence. In conclusion, by embracing the tapestry of daily connections, we can enrich our personal journey and discover profound meaning in an ever-evolving world.`,
    wordCount: 137,
    expectedCharacteristics: ['Overly sentimental generic AI voice', 'Cliché lexicon (tapestry, journey, pivotal role, testament to)', 'Zero concrete details or personal specificity'],
  },
  {
    id: 'llm-09',
    domain: 'conversational-op-ed',
    label: 'llm',
    title: 'The Balance of Innovation and Practicality in Modern Technology',
    text: `In recent decades, smart home devices have undeniably transformed the way we manage our domestic environments. It is important to remember that technological innovation brings both remarkable conveniences and meaningful considerations for modern consumers. Furthermore, seamless connectivity plays a pivotal role in streamlining household routines and improving energy efficiency. Moreover, navigating the complexities of connected appliances requires users to balance automated features with long-term reliability. It can be argued that cultivating practical consumer habits fosters a healthier relationship with digital tools. Additionally, manufacturers must prioritize transparency to underscore the importance of user privacy and device longevity. Ultimately, technology should serve human needs rather than creating unnecessary complications. In conclusion, adopting a balanced approach to smart living enables individuals to enjoy modern advancements while maintaining autonomy and peace of mind in an ever-evolving digital landscape.`,
    wordCount: 137,
    expectedCharacteristics: ['Neutral non-committal hedging', 'Rule-of-three framing', 'Formulaic transitions', 'Predictable cliché clusters'],
  },
  {
    id: 'llm-10',
    domain: 'dense-academic',
    label: 'llm',
    title: 'Algorithmic Architectures and Epistemic Dynamics in Digital Networks',
    text: `In the realm of contemporary digital communications, recommendation algorithms play a pivotal role in structuring information dissemination across global platforms. It is worth noting that computational filtering mechanisms significantly influence user perception and epistemic behavior. Furthermore, statistical optimization models underscore the importance of balancing user engagement metrics with substantive content diversity. Moreover, analyzing algorithmic feedback loops highlights the multifaceted nature of digital discourse in contemporary society. In addition to mathematical modeling, empirical sociological observations foster a comprehensive overview of ideological clustering within online communities. Notably, cognitive biases and automated curation mechanisms work in tandem to accelerate echo-chamber dynamics. It can be argued that cross-disciplinary research is essential for addressing these systemic challenges. In conclusion, advancing algorithmic transparency remains a vital imperative for preserving democratic integrity and epistemic resilience in an ever-evolving information ecosystem.`,
    wordCount: 139,
    expectedCharacteristics: ['Academic jargon used as superficial decoration', 'High concentration of AI transition markers', 'Low sentence length variance', 'Uniform syntactic rhythm'],
  },
];
