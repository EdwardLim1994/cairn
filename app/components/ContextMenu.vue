<script setup lang="ts">
const props = defineProps<{ position: { x: number; y: number } }>();
const emit = defineEmits<{ addService: [] }>();
</script>

<template>
  <div
    class="app__context-menu app__surface"
    :style="{ left: `${props.position.x}px`, top: `${props.position.y}px` }"
    @click.stop
  >
    <button type="button" @click="emit('addService')"><b>+</b> Add new service</button>
  </div>
</template>
