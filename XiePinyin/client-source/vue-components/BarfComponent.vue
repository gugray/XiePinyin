<template>
  <p>{{ message }}</p>
</template>

<script>
  export default {
    props: [
      'prop1',
      'prop2',
      'prop3'
    ],
    data: function () {
      return {
        message: "[test website]",
      }
    },
    name: "barf-component"
  }
</script>
