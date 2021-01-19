<script>
  export let inputType = "simp";

  import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

  function onInputType(val) {
    inputType = val;
    dispatch("inputType", { val: val });
  }
</script>

<style>
</style>

<div class="title">
  <div class="docTitle"><span>Sample document</span></div>
</div>
<div class="commands">
  <div class="group grpInputType">
    <div class="item button" class:sel={inputType == "simp"} on:click={ e=> onInputType('simp') }>简体</div>
    <div class="item button" class:sel={inputType == "trad"} on:click={ e=> onInputType('trad') }>繁體</div>
    <div class="item button" class:sel={inputType == "alfa"} on:click={ e=> onInputType('alfa') }>Alpha</div>
  </div>
</div>
