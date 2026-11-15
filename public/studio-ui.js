import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";

export const h = React.createElement;
// shadcn/ui's open-code Button and Dialog composition, adapted to plain CSS without a build step.
const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default: "btn-primary",
      outline: "btn-outline",
      ghost: "btn-ghost",
    },
    size: { default: "", sm: "btn-small", icon: "btn-icon" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export const Button = React.forwardRef(
  ({ className = "", variant, size, ...props }, ref) =>
    h("button", {
      type: "button",
      ref,
      className: buttonVariants({ variant, size, className }),
      ...props,
    }),
);
export const icon = (Icon, props = {}) =>
  h(Icon, { size: 18, "aria-hidden": true, ...props });
export const badge = (text, className = "") =>
  h("span", { className: "badge " + className }, text);

export function Modal({ open, onOpenChange, title, description, children }) {
  return h(
    Dialog.Root,
    { open, onOpenChange },
    h(
      Dialog.Portal,
      null,
      h(Dialog.Overlay, { className: "dialog-overlay" }),
      h(
        Dialog.Content,
        { className: "dialog-content" },
        h(Dialog.Title, { className: "dialog-title" }, title),
        h(Dialog.Description, { className: "dialog-description" }, description),
        h(
          Dialog.Close,
          { asChild: true },
          h(
            Button,
            { variant: "ghost", size: "icon", className: "dialog-close", "aria-label": "닫기" },
            icon(X),
          ),
        ),
        children,
      ),
    ),
  );
}

const renderInline = (tokens) =>
  tokens.map((token, i) =>
    token.type === "code"
      ? h("code", { key: i }, token.text)
      : token.type === "bold"
        ? h("strong", { key: i }, token.text)
        : token.text,
  );
// 문제 설명·해설을 그립니다. 해석은 PcoMarkdown(studio-markdown.js)이 하고, 여기서는 React 요소만 만듭니다.
export function Markdown({ text, className = "" }) {
  return h(
    "div",
    { className: "md " + className },
    PcoMarkdown.parse(text).map((block, i) => {
      if (block.type === "code") return h("pre", { key: i, className: "md-code" }, block.text);
      if (block.type === "ul") return h("ul", { key: i }, block.items.map((item, j) => h("li", { key: j }, renderInline(item))));
      if (block.type === "ol") return h("ol", { key: i }, block.items.map((item, j) => h("li", { key: j }, renderInline(item))));
      if (block.type === "table")
        return h(
          "table",
          { key: i, className: "md-table" },
          h("thead", null, h("tr", null, block.head.map((cell, j) => h("th", { key: j }, cell)))),
          h("tbody", null, block.rows.map((row, r) => h("tr", { key: r }, row.map((cell, j) => h("td", { key: j }, cell))))),
        );
      return h("p", { key: i }, renderInline(block.tokens));
    }),
  );
}

export function ProgressBar({ value, label, className = "" }) {
  return h(
    "div",
    {
      className: "progress-track " + className,
      role: "progressbar",
      "aria-label": label,
      "aria-valuenow": value,
      "aria-valuemin": 0,
      "aria-valuemax": 100,
    },
    h("div", { className: "progress-fill", style: { width: `${value}%` } }),
  );
}

export const HOW_LABEL = {
  quiz: "통과",
  exam: "승급 시험으로 통과",
  jump: "점프로 통과",
  placement: "진단평가로 통과",
};
export const levelTitle = (track) => `${track.name} ${track.label}`;
