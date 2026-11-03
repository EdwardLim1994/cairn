<template>
  <NuxtPage />
</template>

<style>
.app .app__endpoint-handle,
.app .app__service-source {
  width: 10px;
  height: 10px;
  border: 2px solid var(--panel);
  background: var(--edge);
}

.app .app__endpoint-handle { left: -5px; }
.app .app__endpoint-source { right: -5px; }
.app .app__endpoint-handle--collapsed,
.app .app__endpoint-source--collapsed { top: 75px; }
.app .app__service-source { right: -5px; top: 28px; }
</style>
