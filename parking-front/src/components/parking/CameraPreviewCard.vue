<template>
  <article :class="['camera-card', mode]">
    <header>
      <h2>{{ title }}</h2>
      <span :class="['live-state', status]"><i></i>{{ status === 'online' ? 'Live' : 'Offline' }}</span>
    </header>

    <div v-if="mode === 'detection'" class="detection-grid">
      <div v-for="item in 4" :key="item" class="camera-scene detection-scene">
        <span class="timestamp">AI Car Free Slot {{ item + 1 }}</span>
        <span class="box yellow one"></span>
        <span class="box yellow two"></span>
        <span class="box green three"></span>
        <span class="box green four"></span>
        <span class="pillar one">B0{{ item }}</span>
        <span class="pillar two">C0{{ item }}</span>
        <span class="scene-car car-a"></span>
        <span class="scene-car car-b"></span>
        <span class="scene-car car-c"></span>
      </div>
    </div>

    <div v-else class="camera-scene staff-scene">
      <span class="timestamp">03-05-2026 Sun 00:38:45</span>
      <span class="pillar one">B03</span>
      <span class="pillar two">C03</span>
      <span class="scene-car car-a"></span>
      <span class="scene-car car-b"></span>
      <span class="scene-car car-c"></span>
      <span class="direction-arrow"></span>
      <span class="plate">B-4CB{{ plateSuffix }}</span>
    </div>
  </article>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    status?: 'online' | 'offline'
    mode?: 'staff' | 'detection'
    plateSuffix?: string
  }>(),
  {
    status: 'online',
    mode: 'staff',
    plateSuffix: '6',
  },
)
</script>

<style scoped>
.camera-card {
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
}

.camera-card header {
  height: 40px;
  border-bottom: 1px solid #5c5c5c;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
}

.camera-card h2 {
  color: #242424;
  font-size: 14px;
  font-weight: 400;
}

.live-state {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #d3342c;
  font-size: 11px;
}

.live-state i {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: currentColor;
}

.live-state.offline {
  color: #7f7f7f;
}

.camera-scene {
  position: relative;
  overflow: hidden;
  border-radius: 5px;
  background:
    linear-gradient(0deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0)),
    linear-gradient(115deg, #1f272a 0 16%, #777d7d 17% 36%, #c8cbc7 37% 52%, #696e6d 53% 100%);
}

.camera-scene::before {
  content: '';
  position: absolute;
  inset: 44% -10% 0;
  background:
    linear-gradient(95deg, transparent 0 32%, rgba(255, 255, 255, 0.18) 33% 34%, transparent 35%),
    radial-gradient(ellipse at 50% 0, rgba(255, 255, 255, 0.18), transparent 55%),
    #676b66;
  transform: perspective(220px) rotateX(45deg);
  transform-origin: top;
}

.staff-scene {
  height: 186px;
  margin: 8px 29px 8px;
}

.detection-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 50px;
  padding: 8px 29px 13px;
}

.detection-scene {
  height: 80px;
  border-radius: 4px;
}

.timestamp {
  position: absolute;
  left: 9px;
  top: 7px;
  z-index: 5;
  color: rgba(255, 255, 255, 0.9);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  text-shadow: 0 1px 1px #000;
}

.detection-scene .timestamp {
  top: 0;
  left: 0;
  border-radius: 2px;
  background: #c7352c;
  padding: 1px 4px;
  font-size: 5px;
}

.pillar {
  position: absolute;
  top: 14px;
  z-index: 3;
  width: 45px;
  height: 132px;
  background: linear-gradient(#d8dddd, #b9bdbb);
  color: #5d4030;
  display: grid;
  place-items: end center;
  padding-bottom: 12px;
  font-size: 10px;
}

.pillar.one {
  left: 25%;
}

.pillar.two {
  right: 19%;
}

.detection-scene .pillar {
  top: 8px;
  width: 20px;
  height: 56px;
  font-size: 5px;
  padding-bottom: 4px;
}

.scene-car {
  position: absolute;
  z-index: 4;
  width: 96px;
  height: 47px;
  border-radius: 48% 48% 16px 16px;
  background: linear-gradient(135deg, #1a1d20, #596064 52%, #151719);
  box-shadow: 0 12px 18px rgba(0, 0, 0, 0.48);
}

.car-a {
  left: 2%;
  top: 63px;
  transform: rotate(-13deg);
}

.car-b {
  right: 15%;
  top: 101px;
  transform: rotate(8deg);
  background: linear-gradient(135deg, #dde3e0, #8c9696 55%, #202427);
}

.car-c {
  left: -5%;
  bottom: 14px;
  transform: rotate(18deg);
}

.detection-scene .scene-car {
  width: 43px;
  height: 21px;
  box-shadow: 0 4px 7px rgba(0, 0, 0, 0.45);
}

.detection-scene .car-a {
  top: 28px;
}

.detection-scene .car-b {
  top: 45px;
}

.detection-scene .car-c {
  bottom: 6px;
}

.direction-arrow {
  position: absolute;
  left: 45%;
  bottom: 25px;
  z-index: 3;
  width: 18px;
  height: 82px;
  background: rgba(255, 255, 255, 0.2);
  clip-path: polygon(35% 0, 65% 0, 65% 60%, 100% 60%, 50% 100%, 0 60%, 35% 60%);
}

.plate {
  position: absolute;
  right: 28px;
  bottom: 10px;
  z-index: 5;
  color: #fff;
  font-family: ui-serif, Georgia, serif;
  font-size: 12px;
  font-weight: 800;
  text-shadow: 0 1px 2px #000;
}

.box {
  position: absolute;
  z-index: 6;
  border: 1px solid;
}

.box.yellow {
  border-color: #f5e800;
}

.box.green {
  border-color: #10d24f;
}

.box.one {
  left: 9%;
  top: 18%;
  width: 32%;
  height: 26%;
}

.box.two {
  right: 8%;
  top: 16%;
  width: 35%;
  height: 30%;
}

.box.three {
  left: 16%;
  bottom: 7%;
  width: 31%;
  height: 32%;
}

.box.four {
  right: 2%;
  bottom: 8%;
  width: 34%;
  height: 35%;
}

@media (max-width: 860px) {
  .detection-grid {
    gap: 12px;
  }

  .staff-scene {
    margin-inline: 18px;
  }
}
</style>
