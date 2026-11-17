import os
import sys
import numpy as np
from scipy import ndimage

AUDIO_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_AUDIO = os.path.abspath(os.path.join(AUDIO_DIR, "..", "..", "templates", "audio"))
sys.path.insert(0, TEMPLATE_AUDIO)

from dsp import SR, ns, tt, rng, lp, hp, bp, colored, fades, pan, place, read_wav, write_wav, integrated, true_peak

FPS = 30.0


def f2s(frame: float) -> float:
    return frame / FPS


def col(n: int, kind: str, seed: int = 1):
    slope = {"white": 0.0, "pink": 1.0, "brown": 2.0}[kind]
    return colored(n, rng(seed), slope=slope)


def sfx_impact(dur=0.8):
    t = tt(dur)
    n = len(t)
    sub = np.sin(2 * np.pi * (95 * np.exp(-t * 7.0) + 32) * t) * np.exp(-t * 4.5)
    click = bp(rng(99).standard_normal(n), 400, 2800) * np.exp(-t * 45)
    return fades(sub * 0.8 + click * 0.5, 0.003, 0.25)


def sfx_whoosh(dur=0.6, f_lo=180, f_hi=1400):
    t = tt(dur)
    n = len(t)
    nz = col(n, "pink", seed=12)
    env = np.sin(np.pi * (t / dur)) ** 1.6
    return bp(nz, f_lo, f_hi) * env * 1.4


def sfx_water_lap(dur=4.5):
    t = tt(dur)
    n = len(t)
    nz = col(n, "pink", seed=21)
    w = lp(nz, 650) * (0.35 + 0.25 * np.sin(2 * np.pi * 0.55 * t) ** 2)
    bubbles = bp(rng(22).standard_normal(n), 900, 2200) * (np.maximum(0, np.sin(2 * np.pi * 2.3 * t)) ** 6) * 0.15
    return fades(w + bubbles, 0.3, 0.4) * 0.45


def sfx_cavern_rumble(dur=6.8):
    t = tt(dur)
    n = len(t)
    nz = col(n, "brown", seed=31)
    low = lp(nz, 130) * 0.7
    clink = np.zeros(n, dtype=np.float64)
    for k in [0.9, 2.3, 3.8, 5.1]:
        idx = int(k * SR)
        lt = tt(0.35)
        ln = len(lt)
        if idx + ln < n:
            hit = np.sin(2 * np.pi * 1120 * lt) * np.exp(-lt * 18) + bp(rng(int(k * 10)).standard_normal(ln), 1800, 4200) * np.exp(-lt * 35)
            clink[idx:idx + ln] += hit * 0.22
    return fades(low + clink, 0.3, 0.4)


def sfx_drill_rig(dur=4.2):
    t = tt(dur)
    n = len(t)
    motor = np.sin(2 * np.pi * 62 * t) * 0.4 + np.sin(2 * np.pi * 124 * t) * 0.25 + np.sin(2 * np.pi * 186 * t) * 0.15
    chatter = bp(rng(41).standard_normal(n), 250, 1200) * (0.5 + 0.5 * np.sin(2 * np.pi * 14 * t)) * 0.35
    return fades(motor + chatter, 0.2, 0.25) * 0.55


def sfx_drill_stuck(dur=3.4):
    t = tt(dur)
    n = len(t)
    freq = 62 * np.where(t < 1.4, 1.0 - 0.35 * (t / 1.4), 0.0)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    motor = np.sin(phase) * np.where(t < 1.45, 1.0, np.exp(-(t - 1.45) * 8)) * 0.5
    clunk_idx = int(1.4 * SR)
    ct = tt(0.6)
    cn = len(ct)
    clunk = (np.sin(2 * np.pi * 140 * ct) * np.exp(-ct * 12) + bp(rng(55).standard_normal(cn), 600, 2600) * np.exp(-ct * 28)) * 0.85
    out = motor.copy()
    out[clunk_idx:clunk_idx + cn] += clunk
    return fades(out, 0.1, 0.3)


def sfx_tilt_and_breach(dur=4.8):
    t = tt(dur)
    n = len(t)
    creak = np.sin(2 * np.pi * (190 + 40 * np.sin(2 * np.pi * 1.8 * t)) * t) * bp(rng(61).standard_normal(n), 150, 700)
    creak = creak * np.where(t < 2.2, 0.45, 0.05)
    bi = int(2.1 * SR)
    bn = n - bi
    bt = np.arange(bn) / SR
    crack = bp(rng(62).standard_normal(bn), 500, 3800) * np.exp(-bt * 16) * 0.9
    rush = lp(col(bn, "pink", seed=63), 1800) * (1 - np.exp(-bt * 4)) * 0.65
    out = creak.copy()
    out[bi:] += crack + rush
    return fades(out, 0.15, 0.3)


def sfx_whirlpool(dur=7.8):
    t = tt(dur)
    n = len(t)
    nz = col(n, "pink", seed=71)
    fizz = hp(rng(72).standard_normal(n), 2800) * np.exp(-t * 0.4) * 0.18
    swirl = bp(nz, 140, 950) * (0.35 + 0.55 * (t / dur)) * (0.85 + 0.15 * np.sin(2 * np.pi * 1.6 * t))
    sub = lp(col(n, "brown", seed=73), 110) * (0.4 + 0.5 * (t / dur))
    return fades(fizz + swirl + sub, 0.2, 0.3)


def sfx_swallow(dur=6.0):
    t = tt(dur)
    n = len(t)
    roar = lp(col(n, "brown", seed=81), 420) * 0.75
    crunch = np.zeros(n, dtype=np.float64)
    for k in [0.8, 2.1, 3.6]:
        idx = int(k * SR)
        ct = tt(0.45)
        cn = len(ct)
        if idx + cn < n:
            crunch[idx:idx + cn] += bp(rng(int(k * 100)).standard_normal(cn), 350, 2200) * np.exp(-ct * 14) * 0.65
    return fades(roar + crunch, 0.2, 0.3)


def sfx_waterfall_geyser(dur=9.3):
    t = tt(dur)
    n = len(t)
    wf = lp(col(n, "pink", seed=91), 2200) * 0.6 + lp(col(n, "brown", seed=92), 180) * 0.5
    gi = int(5.6 * SR)
    gn = min(ns(2.6), n - gi)
    if gn > 0:
        gt = np.arange(gn) / SR
        boom = np.sin(2 * np.pi * (85 * np.exp(-gt * 5) + 36) * gt) * np.exp(-gt * 2.5) * 0.9
        jet = bp(col(gn, "white", seed=93), 400, 3500) * np.exp(-gt * 1.4) * 0.75
        wf[gi:gi + gn] += boom + jet
    return fades(wf, 0.25, 0.4)


def sfx_alarm_elevator(dur=5.4):
    t = tt(dur)
    n = len(t)
    bell = np.zeros(n, dtype=np.float64)
    for k in [0.2, 0.9, 1.6]:
        idx = int(k * SR)
        bt = tt(0.45)
        bn = len(bt)
        if idx + bn < n:
            ring = (np.sin(2 * np.pi * 880 * bt) + 0.6 * np.sin(2 * np.pi * 1320 * bt)) * np.exp(-bt * 6.5) * (0.6 + 0.4 * np.sin(2 * np.pi * 24 * bt))
            bell[idx:idx + bn] += ring * 0.38
    elev = bp(col(n, "pink", seed=101), 160, 500) * np.where((t > 2.1) & (t < 4.7), 0.35, 0.0)
    return fades(bell + elev, 0.05, 0.25)


def sfx_corks_pop(dur=4.2):
    t = tt(dur)
    n = len(t)
    water = lp(col(n, "pink", seed=111), 700) * 0.25
    pops = np.zeros(n, dtype=np.float64)
    for i, k in enumerate([0.6, 1.0, 1.35, 1.75, 2.05, 2.4, 2.75]):
        idx = int(k * SR)
        pt = tt(0.22)
        pn = len(pt)
        if idx + pn < n:
            f0 = 240 + i * 25
            pop = np.sin(2 * np.pi * (f0 + 320 * (1 - np.exp(-pt * 35))) * pt) * np.exp(-pt * 22)
            splash = bp(rng(200 + i).standard_normal(pn), 700, 2600) * np.exp(-pt * 18) * 0.3
            pops[idx:idx + pn] += (pop * 0.55 + splash)
    return fades(water + pops, 0.1, 0.35)


def main():
    voice, sr = read_wav(os.path.join(AUDIO_DIR, "voice.wav"))
    voice = voice[0]  # (N,)
    total_n = len(voice) + ns(0.6)
    sfx_bus = np.zeros((2, total_n), dtype=np.float64)

    cues = [
        (f2s(1), sfx_impact(0.9), 0.0, 0.95),
        (f2s(8), sfx_whoosh(0.65), -0.2, 0.55),
        (f2s(171), sfx_water_lap(4.3), 0.1, 0.55),
        (f2s(303), sfx_cavern_rumble(6.8), -0.1, 0.65),
        (f2s(511), sfx_drill_rig(4.2), 0.0, 0.55),
        (f2s(644), sfx_drill_stuck(3.4), 0.0, 0.70),
        (f2s(754), sfx_tilt_and_breach(4.8), 0.05, 0.80),
        (f2s(904), sfx_whirlpool(7.8), 0.0, 0.65),
        (f2s(1145), sfx_swallow(6.0), -0.05, 0.75),
        (f2s(1332), sfx_waterfall_geyser(9.3), 0.0, 0.80),
        (f2s(1619), sfx_alarm_elevator(5.4), 0.1, 0.65),
        (f2s(1786), sfx_corks_pop(4.2), 0.0, 0.75),
    ]

    for start_s, mono, p, gain in cues:
        place(sfx_bus, pan(mono, p), start_s, gain)

    # Lightweight stereo room ambience
    d1, d2 = int(0.019 * SR), int(0.031 * SR)
    wet = np.zeros_like(sfx_bus)
    wet[0, d1:] += sfx_bus[1, :-d1] * 0.22
    wet[1, d2:] += sfx_bus[0, :-d2] * 0.22
    sfx_bus = sfx_bus * 0.90 + wet

    v_pad = np.zeros(total_n, dtype=np.float64)
    v_pad[:len(voice)] = voice
    v_st = np.stack([v_pad, v_pad])

    # Duck SFX cleanly underneath speech
    v_env = ndimage.maximum_filter1d(np.abs(v_pad), size=int(0.18 * SR))
    v_env = ndimage.uniform_filter1d(v_env, size=int(0.12 * SR))
    duck = 1.0 - 0.58 * np.clip(v_env / 0.08, 0.0, 1.0)
    sfx_ducked = sfx_bus * duck[None, :]

    # Voice + SFX only (NO MUSIC)
    mix = v_st * 0.92 + sfx_ducked * 0.48

    cur_lufs = integrated(mix)
    gain_db = -14.0 - cur_lufs
    mix = mix * (10.0 ** (gain_db / 20.0))

    peak = np.max(np.abs(mix))
    if peak > 0.89:
        mix = np.tanh(mix * (0.89 / peak) * 1.1) * 0.89

    out_wav = os.path.join(AUDIO_DIR, "mix.wav")
    write_wav(out_wav, mix)
    print(f"Generated SFX-only mix.wav (NO MUSIC): {mix.shape[1]/SR:.3f}s, LUFS={integrated(mix):.2f}, peak={true_peak(mix):.2f} dBTP")


if __name__ == "__main__":
    main()
