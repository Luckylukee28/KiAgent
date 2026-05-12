// Spatial workspace configuration — clusters with positions and accent colors.
// Each cluster is a defined "zone" where related agents live; this replaces
// the chaotic random spiral with a calm, structured layout.

export interface ClusterDef {
  id: string
  label: string
  description: string
  accent: string          // saturated stroke / glow
  bgFrom: string          // subtle gradient start
  bgTo: string            // subtle gradient end
  position: { x: number; y: number }    // top-left of cluster zone
  size: { w: number; h: number }
  categories: string[]    // which AgentMeta.category values belong here
  icon: string
}

export const CLUSTERS: ClusterDef[] = [
  {
    id: 'planning',
    label: 'Planning',
    description: 'Roadmap & coordination',
    accent: '#34d399',
    bgFrom: 'rgba(52, 211, 153, 0.06)',
    bgTo:   'rgba(52, 211, 153, 0.02)',
    position: { x: -240, y: -680 },
    size: { w: 480, h: 220 },
    categories: ['PLANUNG'],
    icon: '◐',
  },
  {
    id: 'coder',
    label: 'AI Coders',
    description: 'Parallel code generation',
    accent: '#22d3ee',
    bgFrom: 'rgba(34, 211, 238, 0.06)',
    bgTo:   'rgba(34, 211, 238, 0.02)',
    position: { x: -1080, y: -260 },
    size: { w: 760, h: 540 },
    categories: ['CODER'],
    icon: '◇',
  },
  {
    id: 'synthese',
    label: 'Synthesis',
    description: 'Merging outputs',
    accent: '#a78bfa',
    bgFrom: 'rgba(167, 139, 250, 0.06)',
    bgTo:   'rgba(167, 139, 250, 0.02)',
    position: { x: 320, y: -340 },
    size: { w: 360, h: 220 },
    categories: ['SYNTHESE'],
    icon: '◈',
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Quality & evaluation',
    accent: '#fbbf24',
    bgFrom: 'rgba(251, 191, 36, 0.06)',
    bgTo:   'rgba(251, 191, 36, 0.02)',
    position: { x: 320, y: -80 },
    size: { w: 360, h: 220 },
    categories: ['REVIEW'],
    icon: '◉',
  },
  {
    id: 'debatte',
    label: 'Debate',
    description: 'Multi-model discussion',
    accent: '#f472b6',
    bgFrom: 'rgba(244, 114, 182, 0.06)',
    bgTo:   'rgba(244, 114, 182, 0.02)',
    position: { x: -540, y: 380 },
    size: { w: 1080, h: 220 },
    categories: ['DEBATTE'],
    icon: '◎',
  },
]

export const CENTER = { x: 0, y: 0 }

// Card geometry inside a cluster
export const CARD_W = 230
export const CARD_H = 116
export const CARD_GAP = 16
export const CLUSTER_PADDING_TOP = 56   // header height inside cluster
export const CLUSTER_PADDING_X = 22

export interface PlacedAgent {
  base: string
  category: string
  clusterId: string
  position: { x: number; y: number }
}

/** Pure layout: given agent base names + their categories, return positions. */
export function placeAgentsInClusters(
  agents: Array<{ base: string; category: string }>
): PlacedAgent[] {
  const grouped = new Map<string, typeof agents>()
  const clusterById = new Map(CLUSTERS.map(c => [c.id, c]))

  // 1) Group by cluster id
  for (const a of agents) {
    const cluster = CLUSTERS.find(c => c.categories.includes(a.category)) ?? CLUSTERS[1]
    if (!grouped.has(cluster.id)) grouped.set(cluster.id, [])
    grouped.get(cluster.id)!.push(a)
  }

  // 2) Layout within each cluster as a tidy grid
  const placed: PlacedAgent[] = []
  for (const [clusterId, list] of grouped) {
    const cluster = clusterById.get(clusterId)!
    const usableW = cluster.size.w - CLUSTER_PADDING_X * 2
    const cols = Math.max(1, Math.floor((usableW + CARD_GAP) / (CARD_W + CARD_GAP)))

    list.forEach((agent, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = cluster.position.x + CLUSTER_PADDING_X + col * (CARD_W + CARD_GAP)
      const y = cluster.position.y + CLUSTER_PADDING_TOP + row * (CARD_H + CARD_GAP)
      placed.push({
        base: agent.base,
        category: agent.category,
        clusterId,
        position: { x, y },
      })
    })
  }
  return placed
}

// Agent → cluster lookup (for outsiders that need to know where an agent lives)
export function clusterForCategory(category: string): ClusterDef {
  return CLUSTERS.find(c => c.categories.includes(category)) ?? CLUSTERS[1]
}
