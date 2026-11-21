/**
 * Hard Cliché-Free Benchmark Corpus (20 Passages)
 * Specifically crafted to evaluate SOTA zero-shot detection without reliance on buzzwords.
 * 
 * - 10 Subtle Modern LLM Passages (0 Tier-1 clichés, uniform cadence, structural symmetry)
 * - 10 Challenging Human Passages (tight corporate memos, peer-reviewed STEM, legal/policy)
 */

export interface ClicheFreePassage {
  id: string;
  type: 'human' | 'llm';
  domain: string;
  title: string;
  text: string;
}

export const CLICHE_FREE_CORPUS: ClicheFreePassage[] = [
  // =========================================================================
  // 10 SUBTLE MODERN LLM PASSAGES (Zero Tier-1 clichés)
  // Characterized by uniform clause structures, low burstiness (CV ~0.15-0.22),
  // balanced function-word distributions, and predictable rhythm.
  // =========================================================================
  {
    id: 'llm-subtle-01',
    type: 'llm',
    domain: 'systems-engineering',
    title: 'Distributed Consensus Design',
    text: `Distributed systems require consensus algorithms to ensure data consistency across multiple independent nodes. The Raft protocol organizes consensus through an elected leader that manages log replication. When a leader fails, follower nodes initiate an election after a randomized timeout period. Each node votes for a single candidate during any given term to prevent split votes. Once a candidate receives a majority of votes, it assumes leadership and begins servicing client requests. Log entries are committed only after a quorum of nodes has acknowledged receipt. This architecture maintains state machine safety while minimizing configuration overhead.`
  },
  {
    id: 'llm-subtle-02',
    type: 'llm',
    domain: 'economics',
    title: 'Central Bank Liquidity Mechanisms',
    text: `Central banks use open market operations to manage commercial banking liquidity and guide short-term interest rates. When inflation pressures rise, monetary authorities sell sovereign bonds to absorb excess bank reserves. This reduction in available funds increases interbank lending rates and dampens private sector credit expansion. Conversely, economic slowdowns prompt asset purchases that expand bank balance sheets and lower borrowing costs. Financial intermediaries adjust mortgage and commercial loan rates in response to these policy shifts. Transmission mechanisms depend on asset price channels and household debt obligations.`
  },
  {
    id: 'llm-subtle-03',
    type: 'llm',
    domain: 'biology',
    title: 'Mitochondrial Energy Coupling',
    text: `Cellular respiration converts biochemical energy from nutrients into adenosine triphosphate through metabolic pathways. Glycolysis breaks down glucose in the cytoplasm to produce pyruvate molecules and electron carriers. These intermediates enter the mitochondrial matrix where the citric acid cycle generates reduced cofactors. Membrane-bound protein complexes transfer electrons along the respiratory chain to establish a proton gradient across the inner membrane. ATP synthase couples the return flow of protons with the phosphorylation of adenosine diphosphate. Oxygen acts as the terminal electron acceptor and produces water as a metabolic byproduct.`
  },
  {
    id: 'llm-subtle-04',
    type: 'llm',
    domain: 'computer-science',
    title: 'Static Analysis in Modern Compilers',
    text: `Modern optimizing compilers perform static analysis on intermediate representations to improve binary execution speed. Dataflow analysis tracks variable definitions across basic blocks to identify dead code segments. Control flow graphs model potential execution paths and enable loop invariant code motion. Register allocation algorithms assign temporary variables to physical hardware registers using graph coloring techniques. When register pressure exceeds hardware capacity, variables are spilled into stack memory locations. These transformations preserve program semantics while reducing dynamic instruction counts.`
  },
  {
    id: 'llm-subtle-05',
    type: 'llm',
    domain: 'materials-science',
    title: 'Grain Boundary Diffusion in Superalloys',
    text: `Nickel-based superalloys maintain mechanical integrity under elevated thermal stress through precipitation hardening. Coherent gamma-prime precipitates impede dislocation movement through the face-centered cubic matrix. Elevated operating temperatures promote grain boundary sliding and accelerate creep deformation rates. Metallurgists introduce refractory elements such as rhenium and ruthenium to retard atomic diffusion along grain interfaces. Directional solidification processes eliminate transverse boundaries and produce single-crystal turbine blades. Microstructural stability under cyclical loading determines service life in gas turbine engines.`
  },
  {
    id: 'llm-subtle-06',
    type: 'llm',
    domain: 'urban-planning',
    title: 'Transit-Oriented Development Densities',
    text: `Municipal transport authorities integrate land use regulations with railway corridors to encourage transit-oriented urban growth. Zoning amendments permit higher residential densities within walking distance of rapid transit stations. Reduced parking minimums lower construction costs for multifamily developments and discourage automobile dependence. Retail spaces located on ground levels provide daily necessities for commuting residents and stimulate pedestrian activity. Capital investments in pedestrian crossings and bicycle lanes improve last-mile connectivity. Municipal tax revenues increase as commercial density expands near transit nodes.`
  },
  {
    id: 'llm-subtle-07',
    type: 'llm',
    domain: 'environmental-science',
    title: 'Estuarine Sediment Transport Dynamics',
    text: `Tidal fluctuations govern sediment suspension and deposition patterns within coastal estuaries. Ebb and flood tides generate shear stresses along benthic beds that mobilize fine cohesive silt particles. Salinity gradients induce flocculation where clay minerals aggregate into larger settling clusters. During slack water intervals, reduced turbulence permits suspended particulates to settle into intertidal mudflats. Dredging activities alter hydrodynamic flow paths and modify natural sedimentation equilibria. Long-term estuarine management requires monitoring bathymetric variations and river inflow volumes.`
  },
  {
    id: 'llm-subtle-08',
    type: 'llm',
    domain: 'cryptography',
    title: 'Lattice-Based Post-Quantum Schemes',
    text: `Post-quantum cryptographic algorithms rely on computational problems over geometric lattices to resist quantum computer attacks. The learning with errors problem introduces small error vectors into linear systems over finite rings. Solving these equations without prior knowledge of the secret key requires finding short lattice vectors. Shor algorithm cannot solve shortest vector approximations in polynomial time on quantum hardware. Standards organizations selected module lattice constructions for digital signature and key encapsulation schemes. Hardware implementations optimize polynomial multiplication through number theoretic transform architectures.`
  },
  {
    id: 'llm-subtle-09',
    type: 'llm',
    domain: 'cognitive-psychology',
    title: 'Working Memory Consolidation Mechanisms',
    text: `Working memory models distinguish between phonological rehearsal buffers and visuospatial sketchpads during information processing. Prefrontal cortical networks maintain task-relevant representations against distracting environmental stimuli. Attentional control processes allocate cognitive resources when tasks demand simultaneous retention and manipulation. Neural oscillations in theta and gamma frequency bands correlate with working memory storage capacity. Information decays within seconds unless refreshed through active rehearsal mechanisms. Sleep phases facilitate the transfer of temporary memory traces to neocortical structures.`
  },
  {
    id: 'llm-subtle-10',
    type: 'llm',
    domain: 'astrophysics',
    title: 'Accretion Disk Temperature Profiles',
    text: `Matter falling into supermassive black holes forms geometrically thin accretion disks that radiate thermal energy. Viscous dissipation transforms gravitational potential energy into electromagnetic radiation across ultraviolet and X-ray bands. Standard accretion models predict disk temperature decreases with radial distance following a power-law relationship. Relativistic frame dragging modifies inner disk boundaries and shifts emission line profiles. Radiation pressure balances gravitational attraction when accretion rates approach the Eddington limit. Observational spectra constrain black hole spin parameters and accretion geometries.`
  },

  // =========================================================================
  // 10 CHALLENGING HUMAN PASSAGES
  // Tight, disciplined, professional human writing from STEM papers, legal briefs,
  // engineering postmortems, and technical memoranda.
  // =========================================================================
  {
    id: 'human-tight-01',
    type: 'human',
    domain: 'legal-policy',
    title: 'Patent Claim Construction Memorandum',
    text: `Claim 1 recites "a resilient latch member biased toward a locked position." The patentee disavowed rigid, unyielding members during prosecution; see File Wrapper at 14 ("the claimed latch must flex"). Defendant's accused widget uses a cast-iron tooth on an unyielding pivot pin—it rotates, but it does not bend. Under Phillips, words take their ordinary meaning in light of the specification, which nowhere equates rigid pivoting with resilient flexing. Summary judgment of non-infringement is warranted on this record.`
  },
  {
    id: 'human-tight-02',
    type: 'human',
    domain: 'engineering-postmortem',
    title: 'Incident 2024-09-12 Cache Invalidation Bug',
    text: `At 14:02 UTC, deployment 482 went live. Within four minutes, redis-cluster CPU hit 99%, triggering pod evictions. The culprit: a stray cache-bust hook in user profile updates that purged 800,000 keys concurrently on every avatar upload. No jitter, no rate limit. We reverted the commit at 14:18, but cache cold-starts kept latency pinned at 4.2 seconds until 14:41. Action item 1: ban unscoped wildcards in flush calls—period.`
  },
  {
    id: 'human-tight-03',
    type: 'human',
    domain: 'stem-peer-review',
    title: 'Reviewer Comments on Ferroelectric Thin Films',
    text: `The authors claim room-temperature switching in 2 nm HfO2 films, yet Figure 3b shows leakage currents exceeding 10 mA/cm^2 at 0.8 V. At this density, Joule heating accounts for the entire observed hysteresis! The authors must measure capacitance-voltage curves at 100 kHz or show pulsed PUND measurements to rule out charge trapping. Without these controls, the ferroelectric conclusion is unproven.`
  },
  {
    id: 'human-tight-04',
    type: 'human',
    domain: 'corporate-memo',
    title: 'Q3 Datacenter Consolidation Update',
    text: `We shut down Dublin Pod-B three weeks early, pocketing $140k in cooling leases. Half the racks moved to Frankfurt; the rest were scrapped. Latency to London nudged up 2.4 ms—within SLA, so customers didn't notice. Frankfurt power costs are another story; our contract renews in November, and wholesale kilowatt-hour rates jumped 18%. Jim's team is looking into night-shift batch runs to trim peak demand charges.`
  },
  {
    id: 'human-tight-05',
    type: 'human',
    domain: 'applied-math',
    title: 'Sparse Cholesky Ordering Note',
    text: `Nested dissection orderings beat approximate minimum degree on planar meshes, but fail horribly on 3D finite-element grids with high aspect ratios. Why? Boundary separator sets grow like O(N^(2/3)) rather than O(N^(1/2)). In our benchmarks, fill-in doubled on the 500k-node turbine casing model. If you're solving 3D elasticity, stick to METIS with multi-level graph partitioning—or prepare to buy more RAM.`
  },
  {
    id: 'human-tight-06',
    type: 'human',
    domain: 'medical-case',
    title: 'Clinical Case Presentation',
    text: `A 64-year-old male presented with progressive resting tremor and cogwheel rigidity in the right upper extremity. Symptoms began 8 months prior, initially attributed to cervical radiculopathy. Brain MRI showed no focal lesions; DaTscan confirmed marked asymmetric reduction of dopamine transporter uptake in the left putamen. We started carbidopa/levodopa 25/100 mg tid. At two-week follow-up, tremor severity had dropped 60% without orthostasis.`
  },
  {
    id: 'human-tight-07',
    type: 'human',
    domain: 'linux-kernel',
    title: 'Kernel Patch Commit Message',
    text: `btrfs: fix race condition during async discard worker flush. When running high-throughput fstrim on zoned NVMe drives, block group allocation can race with async discard work queues. If an allocation occurs while discard_bytes is being recalculated, a null-pointer dereference occurs in btrfs_discard_cancel_work. Add a spinlock around discard_ctl->lock to serialize updates. Verified with xfstests generic/260 on a 4-drive RAID0 array.`
  },
  {
    id: 'human-tight-08',
    type: 'human',
    domain: 'finance-audit',
    title: 'Revenue Recognition Finding',
    text: `During our testing of deferred revenue balances as of December 31, we noted three multi-element software contracts totaling $4.2M where professional services were bundled with term licenses without standalone selling price (SSP) documentation. Management recognized the full license component upon delivery, contrary to ASC 606-10-32-28. The misstatement overstated Q4 operating income by $1.8M. An adjusting entry is required.`
  },
  {
    id: 'human-tight-09',
    type: 'human',
    domain: 'aerospace',
    title: 'Wind Tunnel Calibration Log',
    text: `Run 44: Mach 0.85 at 20,000 ft equivalent pressure. Dynamic pressure held at 480 psf. Pitch sweep from -2 to +14 degrees alpha. At alpha = 11.2 degrees, sensor port 18 showed sudden pressure recovery collapse, indicating leading-edge stall onset. Pitot-static tube heating was on throughout. Note: Schlieren camera frame 812 shows shock oscillation on the upper foil; check pressure tap 14 for grease fouling before tomorrow's run.`
  },
  {
    id: 'human-tight-10',
    type: 'human',
    domain: 'philosophy',
    title: 'Epistemic Closure Note',
    text: `Dretske denies epistemic closure: you can know you have hands (because you see them) without knowing you are not a brain in a vat (since the sensory evidence would be identical). Nozick agrees, but under a tracking theory: belief tracks truth in normal nearby worlds, but not across radical skeptical scenarios. Is this satisfactory? Most epistemologists balk: if knowledge does not distribute over known entailment, reasoning becomes an epistemic sieve.`
  },
];
