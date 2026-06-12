function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function generateLeadsFromJob(job) {
  const names = ['Studio Atlas', 'Nord Deco', 'Maison Smart', 'Urban Craft', 'Design Plus'];
  const categories = ['Decoration', 'Mobilier', 'Construction', 'Electronique', 'Alimentaire'];
  const cities = ['Tunis', 'Sfax', 'Sousse', 'Bizerte', 'Nabeul', 'Gabes', 'Kairouan'];

  const limit = Math.min(Math.max(Number(job.limit || 20), 1), 200);
  const resultCount = Math.min(limit, 10);

  return Array.from({ length: resultCount }).map((_, index) => {
    const city = job.city && job.city !== 'all' ? job.city : pickRandom(cities);
    const category = job.category && job.category !== 'all' ? job.category : pickRandom(categories);
    return {
      id: `L${Date.now().toString().slice(-6)}${index}`,
      name: `${pickRandom(names)} ${index + 1}`,
      category,
      phone: `+216 ${Math.floor(20000000 + Math.random() * 70000000)}`,
      city,
      source: 'Google Maps',
      status: 'nouveau',
      email: `lead${Math.floor(Math.random() * 9999)}@example.tn`,
      address: `${city}, Tunisie`,
      notes: `Genere via scraping: ${job.query || 'general'}`,
    };
  });
}

export function createScrapeService({ jobsRepo, leadsRepo }) {
  const activeTimers = new Map();

  async function startJob(payload) {
    const id = createId('job');
    const job = {
      id,
      status: 'queued',
      query: payload.query || '',
      category: payload.category || 'all',
      city: payload.city || 'all',
      limit: Number(payload.limit || 20),
      startedAt: nowIso(),
      completedAt: null,
      createdCount: 0,
    };

    await jobsRepo.create(job);

    const timer = setTimeout(async () => {
      await jobsRepo.update(id, { status: 'running' });

      const completionTimer = setTimeout(async () => {
        const currentLeads = await leadsRepo.list();
        const generated = generateLeadsFromJob(payload);
        await leadsRepo.replaceAll([...generated, ...currentLeads]);
        await jobsRepo.update(id, {
          status: 'completed',
          completedAt: nowIso(),
          createdCount: generated.length,
        });
        activeTimers.delete(id);
      }, 1200);

      activeTimers.set(id, completionTimer);
    }, 500);

    activeTimers.set(id, timer);
    return job;
  }

  async function getJob(id) {
    return jobsRepo.getById(id);
  }

  return {
    startJob,
    getJob,
  };
}
