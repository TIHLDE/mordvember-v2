import { definePlugin, defineRule, type ESTree } from "vite-plus/lint/plugins";

const noNativeDateInput = defineRule({
  meta: {
    type: "problem",
    schema: [],
    messages: {
      usePicker:
        "Bruk <DateTimePicker> fra @/components/DateTimePicker i stedet for native dato- og tidsfelt.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node: ESTree.JSXOpeningElement) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "input") return;
        for (const attribute of node.attributes) {
          if (
            attribute.type === "JSXAttribute" &&
            attribute.name.type === "JSXIdentifier" &&
            attribute.name.name === "type" &&
            attribute.value?.type === "Literal" &&
            /^(date|datetime-local|time|month|week)$/.test(attribute.value.value)
          ) {
            context.report({ node: attribute, messageId: "usePicker" });
          }
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: "project" },
  rules: { "no-native-date-input": noNativeDateInput },
});
