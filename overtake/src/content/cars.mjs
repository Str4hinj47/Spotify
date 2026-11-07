// Shipped car content. Keep IDs stable forever: they are used in saves.
// Asset-specific profiles still need authoring; see docs/SEASONAL_CONTENT.md.
export const CAR_CONTENT = /** @type {const} */ ([
  {
    "id": "golf",
    "name": "Golf MK4 GTI",
    "maker": "Volkswagen",
    "tagline": "The hot-hatch original. Small, nimble, always up for a gap.",
    "klass": "Hot hatch",
    "maxSpeed": 54,
    "accel": 9.5,
    "handling": 7.5,
    "bonus": 1,
    "stats": {
      "speed": 3,
      "handling": 5,
      "bonus": 3
    },
    "color": "#9fb0bf",
    "credit": "Jay-Artist · CC BY 3.0",
    "physics": {
      "grip": 1.02,
      "brake": 10.5,
      "wheelbase": 2.51,
      "maxSteer": 0.52,
      "understeer": 0.005,
      "yawResponse": 7,
      "steerResponse": 7.5,
      "drag": 0.00075
    },
    "price": 0,
    "trafficCruise": 18,
    "orientationDegrees": 0,
    "collection": "Launch"
  },
  {
    "id": "mercedes",
    "name": "S 63 AMG",
    "maker": "Mercedes-Benz",
    "tagline": "Autobahn royalty. Effortless pace with a velvet hammer.",
    "klass": "Super sedan",
    "maxSpeed": 60,
    "accel": 8.5,
    "handling": 5.5,
    "bonus": 1.1,
    "stats": {
      "speed": 4,
      "handling": 3,
      "bonus": 4
    },
    "color": "#1c2129",
    "credit": "User-provided Drive asset",
    "physics": {
      "grip": 1.05,
      "brake": 11.5,
      "wheelbase": 3.16,
      "maxSteer": 0.48,
      "understeer": 0.002,
      "yawResponse": 5.5,
      "steerResponse": 6,
      "drag": 0.0008
    },
    "price": 9500,
    "trafficCruise": 22.5,
    "orientationDegrees": 0,
    "collection": "Launch"
  },
  {
    "id": "audi",
    "name": "RS 6 Avant",
    "maker": "Audi",
    "tagline": "The long-roof missile. Family wagon, supercar urgency.",
    "klass": "Performance wagon",
    "maxSpeed": 61,
    "accel": 9,
    "handling": 6.5,
    "bonus": 1.1,
    "stats": {
      "speed": 4,
      "handling": 4,
      "bonus": 4
    },
    "color": "#7d8a93",
    "credit": "User-provided Drive asset",
    "physics": {
      "grip": 1.08,
      "brake": 11.5,
      "wheelbase": 2.91,
      "maxSteer": 0.5,
      "understeer": 0.0035,
      "yawResponse": 6.5,
      "steerResponse": 7,
      "drag": 0.00078
    },
    "price": 14000,
    "trafficCruise": 23,
    "orientationDegrees": 180,
    "collection": "Launch"
  },
  {
    "id": "mustang",
    "name": "Mustang GT",
    "maker": "Ford",
    "tagline": "American muscle. Loud, proud, and hungry for the left lane.",
    "klass": "Muscle car",
    "maxSpeed": 58,
    "accel": 9.8,
    "handling": 5.8,
    "bonus": 1,
    "stats": {
      "speed": 4,
      "handling": 3,
      "bonus": 3
    },
    "color": "#1f5fd0",
    "credit": "User-provided Drive asset",
    "physics": {
      "grip": 1,
      "brake": 10.8,
      "wheelbase": 2.72,
      "maxSteer": 0.5,
      "understeer": 0.003,
      "yawResponse": 6.8,
      "steerResponse": 7.2,
      "drag": 0.00082
    },
    "price": 3000,
    "trafficCruise": 21.5,
    "orientationDegrees": 0,
    "collection": "Launch"
  },
  {
    "id": "ferrari",
    "name": "458 Italia",
    "maker": "Ferrari",
    "tagline": "Maranello precision. The fastest way to turn traffic into points.",
    "klass": "Supercar",
    "maxSpeed": 66,
    "accel": 11,
    "handling": 8,
    "bonus": 1.2,
    "stats": {
      "speed": 5,
      "handling": 5,
      "bonus": 5
    },
    "color": "#d40f1e",
    "credit": "RainerS · CC BY 3.0",
    "physics": {
      "grip": 1.18,
      "brake": 13,
      "wheelbase": 2.65,
      "maxSteer": 0.46,
      "understeer": 0.002,
      "yawResponse": 9,
      "steerResponse": 9,
      "drag": 0.00068
    },
    "price": 35000,
    "trafficCruise": 26,
    "orientationDegrees": 193.5,
    "collection": "Launch"
  },
  {
    "id": "r8",
    "name": "R8",
    "maker": "Audi",
    "tagline": "Mid-engine balance and supercar pace.",
    "klass": "Supercar",
    "maxSpeed": 65,
    "accel": 10.6,
    "handling": 8,
    "bonus": 1.2,
    "stats": {
      "speed": 5,
      "handling": 5,
      "bonus": 5
    },
    "color": "#b3bbc3",
    "credit": "User-provided Drive asset",
    "physics": {
      "grip": 1.15,
      "brake": 12.8,
      "wheelbase": 2.65,
      "maxSteer": 0.46,
      "understeer": 0.002,
      "yawResponse": 8.5,
      "steerResponse": 8.5,
      "drag": 0.0007
    },
    "price": 23000,
    "trafficCruise": 25,
    "orientationDegrees": 180,
    "collection": "Launch"
  },
  {
    "id": "challenger",
    "name": "Challenger",
    "maker": "Dodge",
    "tagline": "Big V8 attitude, built for the open road.",
    "klass": "Muscle car",
    "maxSpeed": 59,
    "accel": 9.6,
    "handling": 5.4,
    "bonus": 1.05,
    "stats": {
      "speed": 4,
      "handling": 3,
      "bonus": 3
    },
    "color": "#3f7843",
    "credit": "User-provided Drive asset",
    "physics": {
      "grip": 0.98,
      "brake": 10.6,
      "wheelbase": 2.95,
      "maxSteer": 0.48,
      "understeer": 0.003,
      "yawResponse": 6,
      "steerResponse": 6.5,
      "drag": 0.00085
    },
    "price": 6000,
    "trafficCruise": 21,
    "orientationDegrees": 180,
    "collection": "Launch"
  }
]);
