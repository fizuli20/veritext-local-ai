/**
 * Veritext Local AI - 50-Passage Adversarial & Multi-Domain Benchmark Corpus
 * Evaluates:
 * - 15 Human Passages (5 ESL, 5 Academic Abstracts, 5 Narrative/Technical)
 * - 15 Raw LLM Passages (Chat-GPT 4o, Claude 3.5 Sonnet, Llama 3)
 * - 10 Hybrid Passages (Interleaved Human + AI paragraphs)
 * - 10 Adversarial Attack Passages (Zero-width chars, Cyrillic homoglyphs, cliché-stripped AI, short texts)
 */

export interface BenchmarkItem {
  id: string;
  category: 'human-esl' | 'human-academic' | 'human-narrative' | 'llm-raw' | 'hybrid' | 'adversarial';
  expectedIsAi: boolean;
  domain: 'general' | 'academic' | 'technical' | 'creative' | 'esl-fair';
  title: string;
  text: string;
}

export const ADVERSARIAL_CORPUS: BenchmarkItem[] = [
  // ==========================================
  // 1. AUTHENTIC ESL HUMAN PASSAGES (5)
  // Characterized by taught transition formulas ("Furthermore", "In conclusion")
  // and regular cadence, but genuine organic human thoughts.
  // ==========================================
  {
    id: 'esl-01',
    category: 'human-esl',
    expectedIsAi: false,
    domain: 'esl-fair',
    title: 'ESL Student Essay on Public Transport in Istanbul',
    text: `Public transportation in my hometown of Istanbul has changed significantly during the past ten years. When I was a high school student, getting to Kadikoy required taking two different overcrowded minibuses every morning. Furthermore, traffic on the Bosphorus bridges was unbearable during morning rush hours. Nowadays, the new Marmaray train line goes directly beneath the sea. In addition, the metropolitan municipality has added many electric buses along the major avenues. As a result, my younger brother can reach his university campus in less than forty minutes. We still face crowded trains on Friday evenings, but the daily commute is much better than before.`,
  },
  {
    id: 'esl-02',
    category: 'human-esl',
    expectedIsAi: false,
    domain: 'esl-fair',
    title: 'ESL Software Engineer on Learning Rust',
    text: `Before joining this software company, I only programmed in Python and JavaScript. Therefore, learning Rust was very difficult for me during my first three months. The borrow checker rejected almost every pull request I submitted to our team leader. Moreover, understanding lifetimes required reading the official documentation multiple times. However, my colleagues helped me understand how stack and heap memory actually work. Now I appreciate why compiler errors in Rust prevent concurrency bugs before deployment. In summary, it was a painful learning curve, but my engineering skills improved greatly.`,
  },
  {
    id: 'esl-03',
    category: 'human-esl',
    expectedIsAi: false,
    domain: 'esl-fair',
    title: 'ESL Biology Graduate on Lab Protocol',
    text: `In our laboratory at Baku State University, we tested soil samples collected from agricultural fields near Ganja. First, we measured the electrical conductivity and pH level of each dried sample. Furthermore, we isolated nitrogen-fixing bacteria using selective agar plates in the incubator. We observed colony growth after forty-eight hours at twenty-eight degrees Celsius. Although our centrifuge broke down twice during the second week, we completed all spectrophotometer measurements on schedule. In conclusion, the organic fertilizer treatment showed a positive effect on root nodule development.`,
  },
  {
    id: 'esl-04',
    category: 'human-esl',
    expectedIsAi: false,
    domain: 'esl-fair',
    title: 'ESL Discussion on Remote Work Challenges',
    text: `Working from home has several advantages for software developers, but it also creates unexpected personal difficulties. On one hand, I save two hours every day because I do not commute on the crowded subway. On the other hand, it is very hard to separate my working hours from my family life. Furthermore, junior engineers in our department struggle to ask questions without feeling like they are interrupting senior staff on Slack. In addition, online meetings often become exhausting when people keep their webcams turned off. Therefore, our team decided to meet in person at least once every month.`,
  },
  {
    id: 'esl-05',
    category: 'human-esl',
    expectedIsAi: false,
    domain: 'esl-fair',
    title: 'ESL Travel Reflection on Visiting Kyoto',
    text: `Last autumn, my family and I traveled to Japan for two weeks. Visiting the historical temples in Kyoto was the most memorable part of our trip. Early in the morning, the bamboo forest at Arashiyama was completely quiet and peaceful. However, by midday, hundreds of tourists arrived with selfie sticks, which made walking along the narrow paths difficult. Furthermore, we tried traditional green matcha tea at a small family shop near the river. The shop owner spoke very little English, but she was exceptionally polite and patient with us. In conclusion, experiencing Japanese hospitality left a deep impression on my mind.`,
  },

  // ==========================================
  // 2. FORMAL ACADEMIC ABSTRACTS (5)
  // Characterized by passive voice, lack of contractions, complex Latinate vocabulary.
  // ==========================================
  {
    id: 'acad-01',
    category: 'human-academic',
    expectedIsAi: false,
    domain: 'academic',
    title: 'Solid-State Physics Abstract on Perovskite Solar Cells',
    text: `We investigate the charge-carrier recombination dynamics in tin-lead halide perovskite thin films synthesized via two-step spin coating. Transient absorption spectroscopy reveals an initial bimolecular recombination rate coefficient of 1.4 x 10^-10 cm^3 s^-1 under 1-sun equivalent photoexcitation. Passivation of grain boundaries with hydrophobic fluorinated ammonium cations yields a 34% reduction in trap-assisted non-radiative loss channels. Planar heterojunction photovoltaic devices fabricated with the passivated absorber layer exhibit an open-circuit voltage of 0.86 V and a certified power conversion efficiency of 21.2%. Unencapsulated devices maintain 92% of their initial efficiency after 1200 hours of continuous illumination under ambient conditions.`,
  },
  {
    id: 'acad-02',
    category: 'human-academic',
    expectedIsAi: false,
    domain: 'academic',
    title: 'Immunology Abstract on T-Cell Exhaustion',
    text: `Persistent antigenic stimulation during chronic viral infections induces progressive transcriptional reprogramming in cytotoxic CD8+ T lymphocytes, commonly designated as immune exhaustion. Using single-cell RNA sequencing coupled with assay for transposase-accessible chromatin, we identify a distinct progenitor exhausted subpopulation characterized by high TCF-1 expression and localized open chromatin at the Slamf6 promoter locus. Adoptive transfer experiments demonstrate that this subset retains self-renewal capacity and sustains the proliferative burst following PD-1 targeted immune checkpoint blockade. Conversely, terminal exhausted effectors displaying elevated Tim-3 and CD39 surface expression fail to proliferate and undergo apoptosis.`,
  },
  {
    id: 'acad-03',
    category: 'human-academic',
    expectedIsAi: false,
    domain: 'academic',
    title: 'Economics Abstract on Microfinance Default Rates',
    text: `This paper evaluates the effect of repayment frequency on loan default rates among microfinance borrowers in rural Andhra Pradesh. Utilizing a randomized phased-rollout design across 142 lending groups, we compare weekly repayment schedules with biweekly and monthly installments. Contrary to standard microcredit underwriting doctrine, shifting from weekly to monthly repayment does not increase thirty-day portfolio-at-risk indicators. Furthermore, transaction costs for female entrepreneurial borrowers decrease by 18% under monthly repayment regimes. Instrumental variable estimates indicate that the resulting time savings are redirected toward small-scale agricultural commerce and inventory diversification.`,
  },
  {
    id: 'acad-04',
    category: 'human-academic',
    expectedIsAi: false,
    domain: 'academic',
    title: 'Computer Systems Abstract on NVMe-oF Latency',
    text: `Modern disaggregated storage architectures rely on Non-Volatile Memory Express over Fabrics (NVMe-oF) to decouple compute clusters from persistent flash tiers. However, kernel network stack serialization and interrupt mitigation mechanisms introduce tail latency amplification under microsecond-scale I/O workloads. We present ChronoStore, an asynchronous userspace NVMe-oF transport engine utilizing polling-mode device drivers and zero-copy ring buffers over RDMA fabrics. Evaluation across a 64-node testbed demonstrates that ChronoStore reduces 99.9th percentile read latency from 142 microseconds to 38 microseconds while sustaining 4.8 million random 4KB IOPS per target controller.`,
  },
  {
    id: 'acad-05',
    category: 'human-academic',
    expectedIsAi: false,
    domain: 'academic',
    title: 'Linguistics Abstract on Ergativity in Kartvelian Languages',
    text: `This study re-examines the split-ergative alignment in Old Georgian nominal morphology through a corpus-based diachronic investigation. In the aorist series, transitive subjects consistently receive the ergative case marker -man, whereas direct objects appear in the nominative unmarked form. Our quantitative analysis of ninth-century liturgical manuscripts demonstrates that differential object marking correlates with nominal animacy and topicality rather than aspectual boundedness alone. These findings challenge the classical aspectual split hypothesis for Kartvelian syntax and support a constructional model wherein case assignment reflects discourse-pragmatic prominence.`,
  },

  // ==========================================
  // 3. HUMAN NARRATIVE & TECHNICAL POSTMORTEM (5)
  // High burstiness, colloquial cadence, jargon, short sentences.
  // ==========================================
  {
    id: 'narr-01',
    category: 'human-narrative',
    expectedIsAi: false,
    domain: 'technical',
    title: 'Distributed DB Midnight Outage Postmortem',
    text: `We killed the cluster at 03:14 UTC because node-07 stopped ACKing raft heartbeats. I ran dmesg, saw memory bus corruption, and yanked the blade. The standby replica took over without dropping a single packet. By dawn, we had swapped the memory stick, rerun the parity tests, and brought the machine back into the quorum. Zero customer data lost, but our on-call rotation was thoroughly miserable. We definitely need ECC alerts wired directly to PagerDuty before next quarter.`,
  },
  {
    id: 'narr-02',
    category: 'human-narrative',
    expectedIsAi: false,
    domain: 'creative',
    title: 'Memoir on Grandmothers Wood Stove',
    text: `My grandmother had a heavy cast-iron stove that took up half the kitchen. It smelled of burnt birch bark and stale chicory. On sub-zero February mornings, she would wedge dry pine kindling under the grate, flick a sulfur match, and wait for the iron to pop. When the draft caught, the whole room trembled. We toasted black bread on the lid until the crust blistered. Nobody spoke until the kettle whistled. You don't get that kind of silence in modern apartments.`,
  },
  {
    id: 'narr-03',
    category: 'human-narrative',
    expectedIsAi: false,
    domain: 'general',
    title: 'Investigative Report on Municipal Water Runoff',
    text: `Three miles downstream from the plating factory, the creek turns cloudy grey. State water inspectors visited the drainage canal twice last summer, scribbled numbers on clipboards, and filed zero enforcement actions. Local dairy farmers tell a different story: four calves sickened after drinking from the marsh pasture in August. When we tested runoff samples behind the warehouse, chromium levels exceeded federal discharge ceilings by nearly tenfold. The plant manager declined an on-camera interview, referring questions to an outside corporate counsel who never returned calls.`,
  },
  {
    id: 'narr-04',
    category: 'human-narrative',
    expectedIsAi: false,
    domain: 'creative',
    title: 'Night Shift at an Old Printing Press',
    text: `Ink gets under your fingernails within ten minutes. By 2 a.m., the rotary drums were deafening, spitting out thousands of supermarket flyers into galvanized steel bins. Sal yelled that the web tension was slipping on cylinder three. I grabbed a wrench, cranked the tensioner half a turn counter-clockwise, and watched the paper tauten. The room smelled like ozone and cheap black pigment. We survived on lukewarm diner coffee and stale donuts until the morning driver backed his delivery truck into loading bay four.`,
  },
  {
    id: 'narr-05',
    category: 'human-narrative',
    expectedIsAi: false,
    domain: 'general',
    title: 'Op-Ed on Local Bookstores',
    text: `You cannot browse an algorithmic bookstore with your fingertips. Sure, recommendations on online storefronts are eerily accurate, but they never hand you the scuffed paperback on the bottom shelf that you didn't know you needed. Yesterday at McIntyre's, I stumbled on a 1968 translation of Balkan folk ballads wedged between two thick atlases. The binding was peeling, and somebody had penciled marginal notes in blue ink on page 42. That accident never happens on a smartphone screen.`,
  },

  // ==========================================
  // 4. RAW LLM BENCHMARK PASSAGES (15)
  // Rule-of-three, hedging, formulaic openers, low burstiness.
  // ==========================================
  {
    id: 'llm-01',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'general',
    title: 'LLM on Future of Remote Work',
    text: `In today's rapidly evolving technological landscape, the concept of work has undergone a fundamental transformation. As organizations navigate the complexities of modern business, remote work has emerged as a cornerstone of sustainable operational efficiency. Furthermore, it is important to delve into the multifaceted benefits that distributed teams offer, ranging from enhanced work-life balance to broader talent acquisition. However, embracing this paradigm requires cultivating collaboration, ensuring accountability, and implementing robust digital tools. Ultimately, the future of work stands as a testament to human resilience and digital innovation.`,
  },
  {
    id: 'llm-02',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'general',
    title: 'LLM on Sustainable Agriculture',
    text: `Sustainable agriculture plays a pivotal role in ensuring global food security while safeguarding our planet for future generations. In recent years, researchers and practitioners have increasingly focused on regenerative farming practices that foster soil health and biodiversity. Moreover, by harnessing innovative technologies such as precision irrigation and organic fertilization, farmers can optimize crop yields while minimizing environmental degradation. It is worth noting that transitioning to sustainable methods requires cross-sector collaboration, policy support, and consumer education. In conclusion, sustainable agriculture is not merely an option, but a vital necessity for our ever-evolving world.`,
  },
  {
    id: 'llm-03',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'technical',
    title: 'LLM on Cloud Computing Architecture',
    text: `Cloud computing has revolutionized the modern technological paradigm by providing scalable, flexible, and cost-effective infrastructure solutions. Organizations across diverse industries are migrating workloads to the cloud to streamline operations, enhance security, and drive innovation. Additionally, microservices architecture and containerization play a crucial role in enabling rapid deployment cycles and fault-tolerant system resilience. It is crucial to remember that establishing robust cloud governance and cost optimization frameworks remains paramount. Ultimately, navigating the cloud journey serves as a powerful catalyst for enterprise digital transformation.`,
  },
  {
    id: 'llm-04',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'academic',
    title: 'LLM on Artificial Intelligence Ethics',
    text: `The rapid proliferation of artificial intelligence systems underscores the imperative to delve into the ethical considerations surrounding their development and deployment. As algorithmic decision-making permeates critical sectors such as healthcare, finance, and criminal justice, ensuring transparency, fairness, and accountability becomes vital. Furthermore, mitigating bias in training datasets requires continuous evaluation, multidisciplinary oversight, and proactive policy interventions. Notably, establishing clear governance frameworks serves as a beacon of responsible technological stewardship in our interconnected society.`,
  },
  {
    id: 'llm-05',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'general',
    title: 'LLM on Renewable Energy Transition',
    text: `The transition toward renewable energy sources stands as one of the defining imperatives of our contemporary era. By tapping into wind, solar, and hydroelectric power, nations can substantially reduce greenhouse gas emissions and foster environmental sustainability. Moreover, advancements in energy storage technologies, such as lithium-ion and solid-state batteries, play a pivotal role in overcoming grid intermittency challenges. It is essential to recognize that comprehensive policy frameworks and international partnerships are vital to accelerating this green transition across the globe.`,
  },
  {
    id: 'llm-06',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'creative',
    title: 'LLM on the Rich Tapestry of Human Culture',
    text: `Human culture represents a rich tapestry woven from centuries of tradition, artistic expression, and shared experiences. Across diverse communities, storytelling serves as a powerful bridge connecting past generations with future aspirations. Furthermore, music, literature, and visual arts provide a profound mirror reflecting societal values and collective resilience. By celebrating our cultural heritage, we can foster a deeper sense of empathy and mutual understanding among individuals from all walks of life. Ultimately, embracing this diversity enriches the global human narrative.`,
  },
  {
    id: 'llm-07',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'general',
    title: 'LLM on Digital Mental Health',
    text: `In our fast-paced modern society, mental health awareness has increasingly taken center stage as a vital component of holistic well-being. Mobile health applications, telemedicine platforms, and virtual support groups play an instrumental role in democratizing access to psychological care. Additionally, these digital interventions empower individuals by fostering self-reflection, providing coping mechanisms, and dismantling persistent social stigmas. It is worth emphasizing that digital solutions must complement rather than replace professional clinical expertise. In conclusion, integrating technology into mental health creates transformative avenues for healing.`,
  },
  {
    id: 'llm-08',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'technical',
    title: 'LLM on Cybersecurity Resilience',
    text: `In an era defined by sophisticated cyber threats, organizations must adopt proactive cybersecurity frameworks to safeguard mission-critical data assets. Implementing multi-factor authentication, end-to-end encryption, and zero-trust network architectures plays a vital role in mitigating operational vulnerabilities. Furthermore, fostering a culture of continuous security awareness among personnel ensures that human error does not undermine perimeter defenses. It is imperative to remember that cybersecurity is not a static destination, but an ever-evolving journey requiring vigilance and agile adaptation.`,
  },
  {
    id: 'llm-09',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'general',
    title: 'LLM on Lifelong Learning',
    text: `The modern knowledge economy demands a steadfast commitment to lifelong learning and personal continuous improvement. As technological advancements disrupt traditional job markets, acquiring adaptable skills becomes essential for professional longevity. Online learning platforms, certification programs, and interactive workshops offer accessible pathways for individuals seeking to expand their intellectual horizons. Moreover, embracing a growth mindset fosters adaptability, critical thinking, and creative problem-solving in dynamic environments. In summary, lifelong learning serves as an empowering compass guiding people through transformative changes.`,
  },
  {
    id: 'llm-10',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'general',
    title: 'LLM on Smart Cities',
    text: `Smart cities represent a transformative vision where internet-of-things devices and data analytics converge to optimize municipal management. From automated traffic signal orchestration to intelligent waste management, urban centers are leveraging technology to enhance citizen quality of life. Furthermore, integrating smart infrastructure fosters environmental sustainability by curbing unnecessary energy consumption and reducing vehicular emissions. Notably, municipal leaders must ensure equitable access to digital municipal services to avoid exacerbating socioeconomic divides. Ultimately, smart cities stand as a testament to the power of human ingenuity.`,
  },
  {
    id: 'llm-11',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'academic',
    title: 'LLM on Higher Education Pedagogies',
    text: `Contemporary higher education is currently navigating an unprecedented pedagogical transition catalyzed by emergent digital technologies. Traditional lecture-based formats are increasingly giving way to experiential, student-centered learning paradigms that promote active engagement. Furthermore, collaborative group projects, asynchronous discussion forums, and interactive simulations empower students to take ownership of their educational trajectories. It is worth noting that cultivating critical inquiry and digital literacy remains paramount within this shifting educational landscape. In conclusion, modern pedagogy must strike a harmonious balance between technological innovation and humanistic mentorship.`,
  },
  {
    id: 'llm-12',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'technical',
    title: 'LLM on DevOps Practices',
    text: `The adoption of DevOps practices has profoundly reshaped the landscape of software engineering by fostering seamless collaboration between development and operations teams. Automated continuous integration and continuous deployment pipelines serve as the backbone of modern software delivery, dramatically shortening development lifecycles. Moreover, automated testing frameworks ensure rigorous quality assurance while mitigating the likelihood of production regressions. It is vital to emphasize that successful DevOps implementation hinges upon cultural alignment rather than tooling alone. Ultimately, embracing DevOps empowers enterprises to deliver continuous customer value.`,
  },
  {
    id: 'llm-13',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'general',
    title: 'LLM on Financial Literacy',
    text: `Financial literacy represents an indispensable life skill that empowers individuals to navigate complex economic landscapes with confidence and prudence. Understanding fundamental concepts such as compound interest, risk diversification, and disciplined budgeting lays the groundwork for enduring financial security. Furthermore, cultivating sound financial habits early in life protects households against predatory lending practices and unexpected economic downturns. Notably, educational institutions and financial organizations must collaborate to expand accessible financial literacy initiatives across underprivileged demographics. In conclusion, financial education serves as an invaluable foundation for long-term prosperity.`,
  },
  {
    id: 'llm-14',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'general',
    title: 'LLM on Eco-Tourism',
    text: `Eco-tourism has gained substantial momentum as conscious travelers seek transformative experiences that respect and preserve fragile natural ecosystems. By prioritizing low-impact lodging, conservation funding, and ethical community partnerships, travelers can positively contribute to local economies. Additionally, educational guided excursions foster a profound appreciation for biodiversity and indigenous cultural heritage. It is worth highlighting that tourism operators must maintain rigorous environmental standards to prevent greenwashing and overtourism. Ultimately, responsible travel serves as a powerful testament to our shared responsibility toward environmental stewardship.`,
  },
  {
    id: 'llm-15',
    category: 'llm-raw',
    expectedIsAi: true,
    domain: 'creative',
    title: 'LLM on the Symphony of Seasons',
    text: `The changing of seasons unfolds as a breathtaking symphony of color, temperature, and natural renewal. In autumn, vibrant amber and crimson leaves paint the landscape, reminding us of the fleeting beauty inherent in every passing moment. Furthermore, the arrival of winter brings a serene tranquility, blanketing the earth in pristine snow and inviting inward contemplation. As spring awakens the dormant soil with delicate blossoms, life begins anew in an exhilarating celebration of vitality. In conclusion, the rhythm of nature serves as a timeless reminder of the cyclical beauty of life.`,
  },

  // ==========================================
  // 5. HYBRID AI + HUMAN MIXED PASSAGES (10)
  // Half human, half AI.
  // ==========================================
  {
    id: 'hyb-01',
    category: 'hybrid',
    expectedIsAi: true,
    domain: 'general',
    title: 'Hybrid Tech Reflection',
    text: `I spent six hours on Saturday ripping out old copper telephone cables from our attic. The insulation was dry-rotted, crumbling into yellow powder every time I tugged a staple loose with my pliers. In today's rapidly evolving technological landscape, home networking infrastructure plays a pivotal role in ensuring seamless connectivity. Furthermore, homeowners must delve into the multifaceted benefits of modern fiber optic cabling to navigate the complexities of contemporary broadband requirements. My hands were blistered by dinner, but at least the cat stopped chewing on the telephone lines.`,
  },
  {
    id: 'hyb-02',
    category: 'hybrid',
    expectedIsAi: true,
    domain: 'general',
    title: 'Hybrid Cooking Blog',
    text: `My cast iron skillet was completely rusted after someone left it soaking in soapy water overnight. I had to scrape it down with coarse kosher salt and steel wool until my forearms cramped. Culinary traditions serve as a rich tapestry connecting generational kitchen wisdom with modern gastronomy. Moreover, maintaining proper cookware is essential for fostering culinary excellence and ensuring delightful dining experiences. I rubbed the bare metal with lard, baked it at 450 degrees for an hour, and had eggs sliding cleanly across it the next morning.`,
  },
  {
    id: 'hyb-03',
    category: 'hybrid',
    expectedIsAi: true,
    domain: 'technical',
    title: 'Hybrid Git Workflow Guide',
    text: `Whenever a teammate rebases an interactive branch onto main without pulling first, the commit history turns into an unreadable tangle of duplicate cherry-picks. Version control systems play an instrumental role in facilitating seamless collaboration among software engineering teams. Additionally, adopting structured branching strategies like Gitflow serves as a beacon of operational efficiency and code quality. Run git reflog, identify the SHA before the botched rebase, and hard reset your local HEAD before force-pushing to the remote repository.`,
  },
  {
    id: 'hyb-04',
    category: 'hybrid',
    expectedIsAi: true,
    domain: 'creative',
    title: 'Hybrid City Rain Memoir',
    text: `The storm gutter outside my second-floor bedroom window overflowed around midnight, drumming like a machine gun on the aluminum awning below. Meteorological phenomena represent an evocative reminder of nature's majestic power and delicate balance. Furthermore, rain serves as a vital catalyst for ecological renewal across diverse urban and rural habitats. I dragged a trash can out onto the porch, wedged it under the broken downspout, and went back to sleep with earplugs.`,
  },
  {
    id: 'hyb-05',
    category: 'hybrid',
    expectedIsAi: true,
    domain: 'general',
    title: 'Hybrid Coffee Roasting Essay',
    text: `Green Ethiopian Yirgacheffe beans smell like dry grass before you dump them into the hot steel drum. When the first crack hit at 390 degrees, sweet citrus and jasmine smoke filled our small garage. Coffee culture plays a pivotal role in fostering community bonding and providing an energizing start to daily routines worldwide. Notably, exploring artisanal roasting methods allows enthusiasts to delve into the nuanced flavor profiles of single-origin beans. We poured the batch onto cooling trays and tasted stone fruit in the cup three days later.`,
  },
  {
    id: 'hyb-06',
    category: 'hybrid',
    expectedIsAi: true,
    domain: 'academic',
    title: 'Hybrid Library Science Analysis',
    text: `We found thirty-two boxes of unbound county probate records decaying in the basement of the courthouse annex. Academic archives serve as a vital repository of cultural memory and scholarly discovery. Moreover, digitizing historical manuscripts plays an indispensable role in democratizing access to primary source materials for future researchers. Silverfish had chewed through several 1890 marriage registers, requiring immediate deacidification and mylar encapsulation before microfilming could begin.`,
  },
  {
    id: 'hyb-07',
    category: 'hybrid',
    expectedIsAi: true,
    domain: 'general',
    title: 'Hybrid Bicycle Repair Story',
    text: `The bottom bracket was frozen solid into the bottom shell of the chromoly frame. I soaked the threads in PB Blaster for three days, clamped an eight-foot iron pipe over the wrench, and leaned my entire body weight into it until it gave a loud metallic crack. Sustainable urban mobility represents an essential solution for reducing carbon emissions and promoting physical health. Ultimately, bicycling stands as a testament to environmentally conscious transportation in modern smart cities. The bearings were completely rusted into brown dust, but the frame was saved.`,
  },
  {
    id: 'hyb-08',
    category: 'hybrid',
    expectedIsAi: true,
    domain: 'general',
    title: 'Hybrid Gardening Journal',
    text: `Aphids destroyed our bell peppers within forty-eight hours of warm weather in late June. Organic horticulture plays a transformative role in nurturing local ecosystems and promoting nutritional wellness. Furthermore, establishing companion planting techniques fosters natural pest deterrence and optimizes soil vitality. I ordered two thousand live ladybugs in a mesh sack, released them at twilight under the leaves, and the infestation was gone by the weekend.`,
  },
  {
    id: 'hyb-09',
    category: 'hybrid',
    expectedIsAi: true,
    domain: 'technical',
    title: 'Hybrid Linux Kernel Note',
    text: `The kernel panicked with a null dereference in the e1000e network driver right after waking from S3 sleep state. Operating system kernels constitute the fundamental bedrock of modern computing infrastructure. In addition, developing resilient device drivers is critical for ensuring seamless hardware integration and preventing catastrophic system failure. I bisected six commits in git, reverted the power management suspend hook, and the machine survived twenty wake-sleep cycles without fault.`,
  },
  {
    id: 'hyb-10',
    category: 'hybrid',
    expectedIsAi: true,
    domain: 'creative',
    title: 'Hybrid Old Bookstore Memory',
    text: `The floorboards in the philosophy aisle creaked like an old sailing ship whenever someone walked toward the back counter. Literature serves as an enduring bridge connecting distant cultures and fostering deep intellectual curiosity. Moreover, physical bookstores stand as a testament to the timeless appeal of tangible reading experiences in a digital era. An elderly cat slept peacefully on a stack of German encyclopedias, completely indifferent to the rain outside.`,
  },

  // ==========================================
  // 6. ADVERSARIAL ATTACK PASSAGES (10)
  // Injected zero-width spaces, Cyrillic homoglyphs, cliché-stripped AI, short paragraphs.
  // ==========================================
  {
    id: 'adv-01',
    category: 'adversarial',
    expectedIsAi: true,
    domain: 'general',
    title: 'Adversarial: Zero-Width Space Injected AI Cliché',
    text: `In to\u200Bday's rapidly ev\u200Colving tech\u200Dnological land\u200Bscape, it is ess\u200Bential to delve into the multi\u200Cfaceted aspects of modern innovation. Fur\u200Bthermore, organizations must nav\u200Cigate these com\u200Bplexities by fostering coll\u200Baboration and en\u200Bsuring seam\u200Cless integration. Ulti\u200Bmately, this ap\u200Bproach stands as a tes\u200Btament to the piv\u200Botal role of digital transformation.`,
  },
  {
    id: 'adv-02',
    category: 'adversarial',
    expectedIsAi: true,
    domain: 'general',
    title: 'Adversarial: Cyrillic Homoglyph Injected AI Essay',
    // Uses Cyrillic 'а', 'е', 'о', 'р', 'с', 'х'
    text: `In tod\u0430y's r\u0430pidly \u0435volving t\u0435chnologi\u0441\u0430l l\u0430nds\u0441\u0430p\u0435, it is import\u0430nt to d\u0435lv\u0435 into th\u0435 t\u0430p\u0435stry of \u0430rtifi\u0441i\u0430l int\u0435llig\u0435n\u0441\u0435. Furth\u0435rmor\u0435, org\u0430niz\u0430tions must n\u0430vig\u0430t\u0435 th\u0435s\u0435 \u0441ompl\u0435xiti\u0435s by fost\u0435ring inn\u043Ev\u0430tion \u0430nd \u0435nsuring s\u0435\u0430ml\u0435ss int\u0435gr\u0430tion. Ultim\u0430t\u0435ly, this s\u0435rv\u0435s \u0430s \u0430 t\u0435st\u0430m\u0435nt to th\u0435 pivot\u0430l rol\u0435 of t\u0435\u0441hnology.`,
  },
  {
    id: 'adv-03',
    category: 'adversarial',
    expectedIsAi: true,
    domain: 'general',
    title: 'Adversarial: Cliché-Stripped AI Passage (Hedging & Cadence Intact)',
    text: `Recent developments across automated data workflows have introduced notable changes to team structures. Project leads frequently adjust their schedules to accommodate shifting timelines and fluctuating resource allocations. When technical milestones overlap with vendor renewals, managers review their deliverables and establish alternative benchmarks. These operational adjustments help maintain consistency across ongoing initiatives. Careful assessment of team velocity ensures that delivery targets remain attainable over the coming quarters.`,
  },
  {
    id: 'adv-04',
    category: 'adversarial',
    expectedIsAi: true,
    domain: 'general',
    title: 'Adversarial: Short 55-Word AI Text',
    text: `Automating routine workflows allows distributed organizations to enhance productivity while reducing operational overhead. Furthermore, implementing modern cloud platforms enables teams to access centralized tools from any location. Ultimately, investing in strategic technology solutions fosters long-term business resilience and agility.`,
  },
  {
    id: 'adv-05',
    category: 'adversarial',
    expectedIsAi: true,
    domain: 'general',
    title: 'Adversarial: Soft Hyphen Injected AI Text',
    text: `In to\u00ADday's fast-paced busi\u00ADness en\u00ADvi\u00ADron\u00ADment, or\u00ADga\u00ADni\u00ADza\u00ADtions must delve into the com\u00ADplex\u00ADities of dig\u00ADi\u00ADtal trans\u00ADfor\u00ADma\u00ADtion. Fur\u00ADther\u00ADmore, seam\u00ADless in\u00ADte\u00ADgra\u00ADtion plays a piv\u00ADot\u00ADal role in en\u00ADsur\u00ADing sus\u00ADtain\u00ADa\u00ADble suc\u00ADcess.`,
  },
  {
    id: 'adv-06',
    category: 'adversarial',
    expectedIsAi: true,
    domain: 'general',
    title: 'Adversarial: Unicode Tag Character Injection',
    text: `Navigating\u{E0020}the\u{E0020}complexities\u{E0020}of\u{E0020}modern\u{E0020}enterprise workflows is essential for fostering operational excellence. Additionally, organizations must ensure seamless integration across diverse departments. Ultimately, this represents a testament to long-term innovation.`,
  },
  {
    id: 'adv-07',
    category: 'adversarial',
    expectedIsAi: true,
    domain: 'general',
    title: 'Adversarial: Mixed Cyrillic and Zero-Width in Cliché Text',
    text: `It is worth not\u0456ng th\u0430t \u0435mb\u0430rking on \u0430 journ\u0435y of digit\u0430l tr\u0430nsform\u0430tion \u200Brequir\u0435s un\u0440r\u0435\u0441\u0435d\u0435nt\u0435d \u0441oll\u0430bor\u0430tion. Furth\u0435rmor\u0435, \u200Corg\u0430niz\u0430tions must f\u043Est\u0435r \u0430 s\u0435ns\u0435 of unity to n\u0430vig\u0430t\u0435 \u0435m\u0435rging obst\u0430\u0441l\u0435s.`,
  },
  {
    id: 'adv-08',
    category: 'adversarial',
    expectedIsAi: true,
    domain: 'general',
    title: 'Adversarial: AI Passive Voice Symmetrical Cadence',
    text: `System components are evaluated on a monthly basis by internal audit committees. Performance metrics are recorded in centralized databases, and compliance reports are submitted to senior leadership for formal verification. Strategic recommendations are developed through collaborative workshops, and corrective actions are implemented across relevant operational units.`,
  },
  {
    id: 'adv-09',
    category: 'adversarial',
    expectedIsAi: false,
    domain: 'esl-fair',
    title: 'Adversarial: ESL Human with Taught Transitions',
    text: `In my country Azerbaijan, tea culture is very important for every family. Furthermore, when guests arrive at our house, we immediately prepare black tea in a traditional armudu glass. In addition, we serve homemade fig jam and walnuts on small glass plates. In conclusion, drinking tea together helps people discuss their daily problems and maintain close friendships.`,
  },
  {
    id: 'adv-10',
    category: 'adversarial',
    expectedIsAi: false,
    domain: 'technical',
    title: 'Adversarial: Terse Human Terminal Log & Action',
    text: `Checked port 5432 with netstat -tulpn. Found postgres bound to localhost only. Edited postgresql.conf, set listen_addresses = '*', updated pg_hba.conf to allow 10.0.0.0/16, and issued systemctl reload postgresql. Ran psql from worker-03, verified query execution in 4ms, and closed ticket INFRA-882.`,
  },
];
