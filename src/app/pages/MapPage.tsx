import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import { Search, AlertCircle, TrendingUp } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { fetchOrdersApi, type OrderRecord } from '../services/api';
import { toast } from 'sonner';

type HeatLevel = 'high' | 'medium' | 'low';
type GeoCountry = 'tunisia' | 'france';

type CityCoordinates = {
  name: string;
  lat: number;
  lng: number;
};

type CityMetric = {
  key: string;
  name: string;
  lat: number;
  lng: number;
  orders: number;
  revenue: number;
  avgBasket: number;
  cancelRate: number;
  level: HeatLevel;
};

type UnmatchedEntry = {
  original: string;
  suggestion: string | null;
  count: number;
};

type AggregateBucket = {
  key: string;
  name: string;
  lat: number;
  lng: number;
  orders: number;
  revenue: number;
  canceledOrders: number;
};

type GeoData = {
  metrics: CityMetric[];
  unmatched: UnmatchedEntry[];
};

type GeoConfig = {
  label: string;
  center: [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  cityCoordinates: Record<string, CityCoordinates>;
  fallbackOrders: OrderRecord[];
};

const TUNISIA_CITY_COORDINATES: Record<string, CityCoordinates> = {
  tunis: { name: 'Tunis', lat: 36.8065, lng: 10.1815 },
  ariana: { name: 'Ariana', lat: 36.8665, lng: 10.1647 },
  'ben arous': { name: 'Ben Arous', lat: 36.7545, lng: 10.2217 },
  bizerte: { name: 'Bizerte', lat: 37.2746, lng: 9.8739 },
  nabeul: { name: 'Nabeul', lat: 36.4561, lng: 10.7376 },
  sousse: { name: 'Sousse', lat: 35.8256, lng: 10.6411 },
  monastir: { name: 'Monastir', lat: 35.7643, lng: 10.8113 },
  sfax: { name: 'Sfax', lat: 34.7406, lng: 10.7603 },
  kairouan: { name: 'Kairouan', lat: 35.6781, lng: 10.0963 },
  mahdia: { name: 'Mahdia', lat: 35.5047, lng: 11.0622 },
  gabes: { name: 'Gabes', lat: 33.8881, lng: 10.0982 },
  medenine: { name: 'Medenine', lat: 33.3547, lng: 10.5055 },
  jerba: { name: 'Djerba', lat: 33.8076, lng: 10.8451 },
  gafsa: { name: 'Gafsa', lat: 34.425, lng: 8.7842 },
  tozeur: { name: 'Tozeur', lat: 33.9197, lng: 8.1335 },
  kef: { name: 'Le Kef', lat: 36.1826, lng: 8.7148 },
  beja: { name: 'Beja', lat: 36.7333, lng: 9.1833 },
};

const FRANCE_CITY_COORDINATES: Record<string, CityCoordinates> = {
  paris: { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  lyon: { name: 'Lyon', lat: 45.764, lng: 4.8357 },
  marseille: { name: 'Marseille', lat: 43.2965, lng: 5.3698 },
  toulouse: { name: 'Toulouse', lat: 43.6047, lng: 1.4442 },
  nice: { name: 'Nice', lat: 43.7102, lng: 7.262 },
  nantes: { name: 'Nantes', lat: 47.2184, lng: -1.5536 },
  bordeaux: { name: 'Bordeaux', lat: 44.8378, lng: -0.5792 },
  lille: { name: 'Lille', lat: 50.6292, lng: 3.0573 },
  strasbourg: { name: 'Strasbourg', lat: 48.5734, lng: 7.7521 },
  montpellier: { name: 'Montpellier', lat: 43.611, lng: 3.8767 },
  rennes: { name: 'Rennes', lat: 48.1173, lng: -1.6778 },
  grenoble: { name: 'Grenoble', lat: 45.1885, lng: 5.7245 },
  dijon: { name: 'Dijon', lat: 47.322, lng: 5.0415 },
  rouen: { name: 'Rouen', lat: 49.4432, lng: 1.0993 },
  reims: { name: 'Reims', lat: 49.2583, lng: 4.0317 },
  'le havre': { name: 'Le Havre', lat: 49.4944, lng: 0.1079 },
};

const TUNISIA_FALLBACK_ORDERS: OrderRecord[] = [
  {
    id: '#10245',
    customer: 'Jean Dupont',
    email: 'jean@example.com',
    status: 'paid',
    payment: 'CB',
    delivery: 'pending',
    amount: 156,
    date: '2026-03-03T14:23:00Z',
    city: 'Tunis',
    address: '123 Avenue Habib Bourguiba, Tunis',
  },
  {
    id: '#10244',
    customer: 'Marie Martin',
    email: 'marie@example.com',
    status: 'shipped',
    payment: 'CB',
    delivery: 'in_transit',
    amount: 289,
    date: '2026-03-03T10:15:00Z',
    city: 'Sousse',
    address: 'Rue de la Republique, Sousse',
  },
  {
    id: '#10243',
    customer: 'Pierre Durand',
    email: 'pierre@example.com',
    status: 'delivered',
    payment: 'COD',
    delivery: 'delivered',
    amount: 543,
    date: '2026-03-02T16:42:00Z',
    city: 'Sfax',
    address: 'Boulevard Tahar Sfar, Sfax',
  },
  {
    id: '#10242',
    customer: 'Sophie Bernard',
    email: 'sophie@example.com',
    status: 'pending',
    payment: 'Pending',
    delivery: 'not_shipped',
    amount: 98,
    date: '2026-03-02T09:18:00Z',
    city: 'Nabeul',
    address: 'Avenue Habib Thameur, Nabeul',
  },
  {
    id: '#10241',
    customer: 'Luc Petit',
    email: 'luc@example.com',
    status: 'paid',
    payment: 'CB',
    delivery: 'pending',
    amount: 234,
    date: '2026-03-02T08:05:00Z',
    city: 'Bizerte',
    address: 'Avenue de la Corniche, Bizerte',
  },
];

const FRANCE_FALLBACK_ORDERS: OrderRecord[] = [
  {
    id: '#20245',
    customer: 'Claire Moreau',
    email: 'claire@example.com',
    status: 'paid',
    payment: 'CB',
    delivery: 'pending',
    amount: 214,
    date: '2026-03-04T10:30:00Z',
    city: 'Paris',
    address: '15 Rue de Rivoli, Paris',
  },
  {
    id: '#20244',
    customer: 'Hugo Laurent',
    email: 'hugo@example.com',
    status: 'shipped',
    payment: 'CB',
    delivery: 'in_transit',
    amount: 332,
    date: '2026-03-03T14:05:00Z',
    city: 'Lyon',
    address: '12 Rue de la Republique, Lyon',
  },
  {
    id: '#20243',
    customer: 'Nina Robert',
    email: 'nina@example.com',
    status: 'delivered',
    payment: 'COD',
    delivery: 'delivered',
    amount: 487,
    date: '2026-03-03T09:42:00Z',
    city: 'Marseille',
    address: '29 La Canebiere, Marseille',
  },
  {
    id: '#20242',
    customer: 'Antoine Petit',
    email: 'antoine@example.com',
    status: 'pending',
    payment: 'Pending',
    delivery: 'not_shipped',
    amount: 139,
    date: '2026-03-02T16:11:00Z',
    city: 'Toulouse',
    address: '8 Place du Capitole, Toulouse',
  },
  {
    id: '#20241',
    customer: 'Emma Girard',
    email: 'emma@example.com',
    status: 'paid',
    payment: 'CB',
    delivery: 'pending',
    amount: 276,
    date: '2026-03-02T11:07:00Z',
    city: 'Lille',
    address: '5 Grand Place, Lille',
  },
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveCityKey(raw: string, cityCoordinates: Record<string, CityCoordinates>): string | null {
  const normalized = normalizeText(raw);
  if (!normalized) {
    return null;
  }

  if (cityCoordinates[normalized]) {
    return normalized;
  }

  const cityKeys = Object.keys(cityCoordinates);
  for (const key of cityKeys) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return key;
    }
  }

  return null;
}

function suggestCity(raw: string, cityCoordinates: Record<string, CityCoordinates>): string | null {
  const normalized = normalizeText(raw);
  if (!normalized) {
    return null;
  }

  const byToken = Object.entries(cityCoordinates).find(([key]) => {
    const head = normalized.split(' ')[0] || '';
    return key.startsWith(head) || head.startsWith(key);
  });

  if (!byToken) {
    return null;
  }

  return byToken[1].name;
}

function pickOrderCity(
  order: OrderRecord,
  cityCoordinates: Record<string, CityCoordinates>
): { key: string | null; raw: string } {
  const candidates = [order.city, order.address].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const key = resolveCityKey(candidate, cityCoordinates);
    if (key) {
      return { key, raw: candidate };
    }
  }

  return {
    key: null,
    raw: (order.city || order.address || 'Ville inconnue').trim(),
  };
}

function levelFromRatio(ratio: number): HeatLevel {
  if (ratio >= 0.66) return 'high';
  if (ratio >= 0.33) return 'medium';
  return 'low';
}

function getLevelColor(level: HeatLevel): string {
  if (level === 'high') return '#16a34a';
  if (level === 'medium') return '#f59e0b';
  return '#3b82f6';
}

function buildCityMetrics(
  orders: OrderRecord[],
  cityCoordinates: Record<string, CityCoordinates>
): { metrics: CityMetric[]; unmatched: UnmatchedEntry[] } {
  const buckets = new Map<string, AggregateBucket>();
  const unknown = new Map<string, { count: number; suggestion: string | null }>();

  for (const order of orders) {
    const { key, raw } = pickOrderCity(order, cityCoordinates);

    if (!key) {
      const label = raw || 'Ville inconnue';
      const previous = unknown.get(label);
      unknown.set(label, {
        count: (previous?.count || 0) + 1,
        suggestion: previous?.suggestion || suggestCity(label, cityCoordinates),
      });
      continue;
    }

    const city = cityCoordinates[key];
    const amount = Number(order.amount || 0);
    const bucket = buckets.get(key) || {
      key,
      name: city.name,
      lat: city.lat,
      lng: city.lng,
      orders: 0,
      revenue: 0,
      canceledOrders: 0,
    };

    bucket.orders += 1;
    bucket.revenue += amount;
    if (normalizeText(order.status) === 'canceled') {
      bucket.canceledOrders += 1;
    }

    buckets.set(key, bucket);
  }

  const rows = Array.from(buckets.values());
  const maxOrders = rows.reduce((max, row) => Math.max(max, row.orders), 1);

  const metrics = rows
    .map((row) => {
      const ratio = row.orders / maxOrders;
      return {
        key: row.key,
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        orders: row.orders,
        revenue: row.revenue,
        avgBasket: row.orders ? row.revenue / row.orders : 0,
        cancelRate: row.orders ? (row.canceledOrders / row.orders) * 100 : 0,
        level: levelFromRatio(ratio),
      } as CityMetric;
    })
    .sort((a, b) => b.orders - a.orders);

  const unmatched = Array.from(unknown.entries())
    .map(([original, entry]) => ({
      original,
      suggestion: entry.suggestion,
      count: entry.count,
    }))
    .sort((a, b) => b.count - a.count);

  return { metrics, unmatched };
}

const GEO_CONFIG: Record<GeoCountry, GeoConfig> = {
  tunisia: {
    label: 'Tunisie',
    center: [34.1, 9.4],
    zoom: 6,
    minZoom: 5,
    maxZoom: 12,
    cityCoordinates: TUNISIA_CITY_COORDINATES,
    fallbackOrders: TUNISIA_FALLBACK_ORDERS,
  },
  france: {
    label: 'France',
    center: [46.2276, 2.2137],
    zoom: 6,
    minZoom: 5,
    maxZoom: 12,
    cityCoordinates: FRANCE_CITY_COORDINATES,
    fallbackOrders: FRANCE_FALLBACK_ORDERS,
  },
};

const FALLBACK_GEO_DATA: Record<GeoCountry, GeoData> = {
  tunisia: buildCityMetrics(GEO_CONFIG.tunisia.fallbackOrders, GEO_CONFIG.tunisia.cityCoordinates),
  france: buildCityMetrics(GEO_CONFIG.france.fallbackOrders, GEO_CONFIG.france.cityCoordinates),
};

export function MapPage() {
  const navigate = useNavigate();
  const [selectedCountry, setSelectedCountry] = useState<GeoCountry>('tunisia');
  const [searchQuery, setSearchQuery] = useState('');
  const [geoDataByCountry, setGeoDataByCountry] = useState<Record<GeoCountry, GeoData>>(FALLBACK_GEO_DATA);
  const [selectedCityByCountry, setSelectedCityByCountry] = useState<Record<GeoCountry, string | null>>({
    tunisia: FALLBACK_GEO_DATA.tunisia.metrics[0]?.key || null,
    france: FALLBACK_GEO_DATA.france.metrics[0]?.key || null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const countryConfig = GEO_CONFIG[selectedCountry];
  const cityMetrics = geoDataByCountry[selectedCountry].metrics;
  const unmatchedAddresses = geoDataByCountry[selectedCountry].unmatched;
  const selectedCityKey = selectedCityByCountry[selectedCountry];

  const setSelectedCityKey = (nextKey: string | null) => {
    setSelectedCityByCountry((prev) => ({
      ...prev,
      [selectedCountry]: nextKey,
    }));
  };

  useEffect(() => {
    let active = true;

    const loadOrders = async () => {
      try {
        const orders = await fetchOrdersApi();
        if (!active) return;

        const nextGeoData: Record<GeoCountry, GeoData> = {
          tunisia: buildCityMetrics(orders, GEO_CONFIG.tunisia.cityCoordinates),
          france: buildCityMetrics(orders, GEO_CONFIG.france.cityCoordinates),
        };

        const mergedGeoData: Record<GeoCountry, GeoData> = {
          tunisia: nextGeoData.tunisia.metrics.length > 0 ? nextGeoData.tunisia : FALLBACK_GEO_DATA.tunisia,
          france: nextGeoData.france.metrics.length > 0 ? nextGeoData.france : FALLBACK_GEO_DATA.france,
        };

        setGeoDataByCountry(mergedGeoData);
        setSelectedCityByCountry((prev) => ({
          tunisia:
            prev.tunisia && mergedGeoData.tunisia.metrics.some((entry) => entry.key === prev.tunisia)
              ? prev.tunisia
              : mergedGeoData.tunisia.metrics[0]?.key || null,
          france:
            prev.france && mergedGeoData.france.metrics.some((entry) => entry.key === prev.france)
              ? prev.france
              : mergedGeoData.france.metrics[0]?.key || null,
        }));

        setLoadError('');
      } catch (_error) {
        if (!active) return;
        setGeoDataByCountry(FALLBACK_GEO_DATA);
        setSelectedCityByCountry({
          tunisia: FALLBACK_GEO_DATA.tunisia.metrics[0]?.key || null,
          france: FALLBACK_GEO_DATA.france.metrics[0]?.key || null,
        });
        setLoadError('Impossible de charger les commandes depuis le serveur. Donnees locales affichees.');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadOrders();

    return () => {
      active = false;
    };
  }, []);

  const filteredCities = useMemo(
    () => cityMetrics.filter((city) => normalizeText(city.name).includes(normalizeText(searchQuery))),
    [cityMetrics, searchQuery]
  );

  useEffect(() => {
    if (!selectedCityKey && filteredCities[0]) {
      setSelectedCityKey(filteredCities[0].key);
      return;
    }

    if (selectedCityKey && !filteredCities.some((city) => city.key === selectedCityKey)) {
      setSelectedCityKey(filteredCities[0]?.key || null);
    }
  }, [filteredCities, selectedCityKey, selectedCountry]);

  const selectedCity = useMemo(
    () => cityMetrics.find((city) => city.key === selectedCityKey) || null,
    [cityMetrics, selectedCityKey]
  );

  const totalOrders = useMemo(
    () => filteredCities.reduce((sum, city) => sum + city.orders, 0),
    [filteredCities]
  );

  const totalRevenue = useMemo(
    () => filteredCities.reduce((sum, city) => sum + city.revenue, 0),
    [filteredCities]
  );

  const maxOrders = useMemo(
    () => Math.max(1, ...filteredCities.map((city) => city.orders)),
    [filteredCities]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1>Geo Analytics - {countryConfig.label}</h1>
        <p className="text-muted-foreground">Carte reelle (OpenStreetMap) avec donnees de commandes par ville</p>
      </div>

      {loadError && (
        <Card className="border-warning bg-warning/5 p-4">
          <p className="text-sm">{loadError}</p>
        </Card>
      )}

      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div className="inline-flex rounded-lg border p-1">
              {(Object.keys(GEO_CONFIG) as GeoCountry[]).map((country) => (
                <Button
                  key={country}
                  type="button"
                  size="sm"
                  variant={selectedCountry === country ? 'default' : 'ghost'}
                  onClick={() => {
                    setSelectedCountry(country);
                    setSearchQuery('');
                  }}
                  className="h-8 px-4"
                >
                  {GEO_CONFIG[country].label}
                </Button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Rechercher une ville..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex items-center gap-6 px-2 text-sm">
            <div>
              <p className="text-muted-foreground">Villes</p>
              <p className="font-semibold">{filteredCities.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Commandes</p>
              <p className="font-semibold">{totalOrders}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Revenu</p>
              <p className="font-semibold">EUR {Math.round(totalRevenue).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3>Carte de chaleur des commandes</h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-600" />
                <span className="text-muted-foreground">Eleve</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">Moyen</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">Faible</span>
              </div>
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chargement de la carte...</div>
            ) : (
              <>
                <MapContainer
                  key={selectedCountry}
                  center={countryConfig.center}
                  zoom={countryConfig.zoom}
                  minZoom={countryConfig.minZoom}
                  maxZoom={countryConfig.maxZoom}
                  scrollWheelZoom
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {filteredCities.map((city) => {
                    const ratio = city.orders / maxOrders;
                    const radius = 8 + ratio * 12;
                    const color = getLevelColor(city.level);

                    return (
                      <CircleMarker
                        key={city.key}
                        center={[city.lat, city.lng]}
                        radius={radius}
                        pathOptions={{
                          color: '#ffffff',
                          weight: 2,
                          fillColor: color,
                          fillOpacity: 0.85,
                        }}
                        eventHandlers={{
                          click: () => setSelectedCityKey(city.key),
                        }}
                      >
                        <Tooltip direction="top" offset={[0, -2]} opacity={1}>
                          <div className="text-xs">
                            <div className="font-semibold">{city.name}</div>
                            <div>{city.orders} commandes</div>
                          </div>
                        </Tooltip>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>

                {filteredCities.length === 0 && (
                  <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
                    Aucune ville trouvee pour cette recherche.
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        <Card className="p-6">
          {selectedCity ? (
            <>
              <h3 className="mb-4">{selectedCity.name}</h3>
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Volume de commandes</p>
                  <p className="text-2xl font-semibold">{selectedCity.orders}</p>
                </div>
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Revenu total</p>
                  <p className="text-2xl font-semibold">EUR {Math.round(selectedCity.revenue).toLocaleString()}</p>
                </div>
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Panier moyen</p>
                  <p className="text-2xl font-semibold">EUR {Math.round(selectedCity.avgBasket).toLocaleString()}</p>
                </div>
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Taux d'annulation</p>
                  <p className="text-2xl font-semibold">{selectedCity.cancelRate.toFixed(1)}%</p>
                </div>
                <div className="pt-4">
                  <Button className="w-full" onClick={() => navigate('/admin/orders')}>
                    Voir commandes filtrees
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-center text-sm text-muted-foreground">Selectionnez une ville sur la carte.</p>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="mb-4">Top villes par volume</h3>
        {filteredCities.length > 0 ? (
          <div className="space-y-2">
            {filteredCities.map((city, index) => (
              <button
                key={city.key}
                type="button"
                onClick={() => setSelectedCityKey(city.key)}
                className={`flex w-full items-center gap-4 rounded-lg border p-3 text-left transition-colors ${
                  selectedCityKey === city.key ? 'border-primary bg-accent' : 'hover:bg-accent/50'
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{city.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {city.orders} commandes | EUR {Math.round(city.revenue).toLocaleString()}
                  </p>
                </div>
                <div className="h-2 max-w-32 flex-1 rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full ${city.level === 'high' ? 'bg-green-600' : city.level === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${(city.orders / maxOrders) * 100}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune ville a afficher.</p>
        )}
      </Card>

      {unmatchedAddresses.length > 0 && (
        <Card className="p-6">
          <div className="mb-4 flex items-start gap-3">
            <AlertCircle className="mt-1 text-warning" size={20} />
            <div>
              <h3>Diagnostics de correspondance</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Certaines villes dans les commandes ne sont pas reconnues automatiquement.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {unmatchedAddresses.map((entry, index) => (
              <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{entry.original}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.count} commande(s)
                    {entry.suggestion ? ` | Suggestion: ${entry.suggestion}` : ''}
                  </p>
                </div>
                {entry.suggestion && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearchQuery(entry.suggestion || '');
                      const suggestedKey = resolveCityKey(entry.suggestion || '', countryConfig.cityCoordinates);
                      if (suggestedKey) {
                        setSelectedCityKey(suggestedKey);
                      }
                      toast.success(`Suggestion appliquee: ${entry.suggestion}`);
                    }}
                  >
                    Corriger
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp size={16} />
          Vue geographique basee sur OpenStreetMap et sur les donnees de commandes de votre backend.
        </div>
      </Card>
    </div>
  );
}

export { MapPage as GeoPage };
