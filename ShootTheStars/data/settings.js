export const settings = {
    "BACKGROUND_COLOR": "#000000",
    "STAR_COUNT": 100,
    "STAR_SIZE_MIN": 1,
    "STAR_SIZE_MAX": 3,
    "STAR_SPEED_MIN": 0.5,
    "STAR_SPEED_MAX": 5,
    "FRAGMENTS_PER_STAR": 5,
    "FRAGMENT_SIZE_MIN": 0.5,
    "FRAGMENT_SIZE_MAX": 1.5,
    "FRAGMENT_SPEED_MIN": 50,
    "FRAGMENT_SPEED_MAX": 150,
    // Purchase completion visual settings
    "PURCHASE_FADE_MS": 1,
    "PURCHASE_PARTICLE_MS": 700,
    "PURCHASE_PARTICLE_COUNT": 18,
    "PURCHASE_PARTICLE_SPEED": 220,
    "sigFigs":7
}

export default function globalizeSettings(){
    globalThis.SETTINGS = settings
}