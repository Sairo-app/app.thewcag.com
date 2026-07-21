export interface CriterionGuidance {
  verify: string;
  test: string;
  pass: string;
}

export const CRITERION_GUIDANCE: Record<string, CriterionGuidance> = {
  "1.1.1": {
    verify: "Every meaningful image, icon, chart, control, and other non-text item has an equivalent text alternative, while decorative content is ignored.",
    test: "Inspect the accessibility tree and experience the content with images unavailable. Check linked images, icon-only controls, charts, CAPTCHAs, and decorative assets.",
    pass: "The text alternative communicates the same purpose or information, and valid WCAG exceptions are documented.",
  },
  "1.2.1": {
    verify: "Prerecorded audio-only and video-only content has an equivalent alternative.",
    test: "Locate every standalone prerecorded audio or silent video asset and compare its alternative with all meaningful information in the recording.",
    pass: "Audio-only content has an accurate transcript and video-only content has an equivalent description or audio track.",
  },
  "1.2.2": {
    verify: "Prerecorded synchronized media includes captions for dialogue and meaningful sound.",
    test: "Play each prerecorded video with audio, enable captions, and compare timing, speaker identification, speech, and important sound cues.",
    pass: "Captions are available, synchronized, accurate, and convey the information needed to understand the media.",
  },
  "1.2.3": {
    verify: "Prerecorded video includes audio description or a complete media alternative for visual information not conveyed in the main audio.",
    test: "Listen without watching, then compare with the visuals. Identify actions, text, scene changes, or context missing from the audio track.",
    pass: "An audio description or equivalent time-based media alternative communicates all necessary visual information.",
  },
  "1.2.4": {
    verify: "Live synchronized media provides captions for spoken content and meaningful sound.",
    test: "Observe a representative live session and compare captions with speech, speaker changes, terminology, timing, and essential audio cues.",
    pass: "Live captions are present and sufficiently accurate and timely for participants to follow the content.",
  },
  "1.2.5": {
    verify: "Prerecorded video has audio description for meaningful visual information not available in the main soundtrack.",
    test: "Review the video with the audio-description track enabled and compare it with actions, text, identities, and scene changes on screen.",
    pass: "Audio description communicates the visual details needed to understand the prerecorded video.",
  },
  "1.3.1": {
    verify: "Visual structure and relationships are available programmatically or in text.",
    test: "Inspect headings, lists, tables, groups, labels, required states, and reading structure with browser semantics and a screen reader.",
    pass: "The programmatic structure represents the visible meaning and relationships without relying only on presentation.",
  },
  "1.3.2": {
    verify: "The programmatic reading and focus sequence preserves meaning.",
    test: "Read the page without CSS, inspect DOM order, and navigate with a screen reader and keyboard through content whose order affects understanding.",
    pass: "Every meaningful sequence remains logical and understandable in the programmatic order.",
  },
  "1.3.3": {
    verify: "Instructions do not depend only on shape, color, size, visual position, orientation, or sound.",
    test: "Search instructions for sensory references such as ‘click the green button’ or ‘use the panel on the right’ and verify an additional identifying cue.",
    pass: "Users can identify the referenced content without perceiving a particular sensory characteristic.",
  },
  "1.3.4": {
    verify: "Content and functionality are not restricted to portrait or landscape unless orientation is essential.",
    test: "Rotate supported phones and tablets in every applicable view, including dialogs, forms, media, and error states.",
    pass: "The interface remains usable in both orientations, or the documented exception is essential to the activity.",
  },
  "1.3.5": {
    verify: "Inputs collecting common personal information expose the correct programmatic purpose.",
    test: "Inspect applicable form controls for valid HTML autocomplete tokens or an equivalent technology-supported input-purpose mechanism.",
    pass: "Each qualifying field has a programmatically determinable purpose that matches the information requested.",
  },
  "1.4.1": {
    verify: "Color is not the only visual means used to communicate information, state, response, or required action.",
    test: "Review errors, charts, links, selected states, validation, and status indicators in grayscale or with color unavailable.",
    pass: "Every meaning conveyed by color is also available through text, shape, pattern, position, or another perceptible cue.",
  },
  "1.4.2": {
    verify: "Audio that starts automatically for more than three seconds can be paused, stopped, or controlled independently.",
    test: "Load each page with system audio enabled and identify autoplaying sound, including media, ambient audio, and notifications.",
    pass: "Long autoplay audio has an easy pause or stop control, or an independent volume control.",
  },
  "1.4.3": {
    verify: "Text and images of text meet the required contrast against their background.",
    test: "Measure foreground and background colors in every state, including placeholders, disabled-looking active controls, overlays, gradients, and focus or hover states.",
    pass: "Normal text is at least 4.5:1 and large text at least 3:1, unless a WCAG exception applies.",
  },
  "1.4.4": {
    verify: "Text can be resized to 200 percent without losing content or functionality.",
    test: "Set browser text-only zoom to 200 percent where supported and exercise navigation, forms, dialogs, tables, and error messages.",
    pass: "All text remains readable and every function remains available without assistive technology, except for valid exceptions.",
  },
  "1.4.5": {
    verify: "Images of text are avoided when real text can provide the same presentation.",
    test: "Identify text rendered inside raster images, SVG paths, canvases, banners, and controls, then check whether it is customizable or essential.",
    pass: "Real text is used unless the image of text is essential or can be visually customized by the user.",
  },
  "1.4.10": {
    verify: "Content reflows without two-dimensional scrolling at the equivalent of 320 CSS pixels wide or 256 CSS pixels high.",
    test: "Test responsive layouts at 320 CSS pixels and at 400 percent zoom. Exercise menus, dialogs, tables, forms, and sticky regions.",
    pass: "Reading and operation require scrolling in only one direction, except where a two-dimensional layout is essential.",
  },
  "1.4.11": {
    verify: "Meaningful non-text graphics and component boundaries or states have sufficient contrast.",
    test: "Measure controls, focus indicators, selected states, form boundaries, icons, and information-bearing graphics against adjacent colors.",
    pass: "Required visual information reaches at least 3:1 contrast unless a criterion exception applies.",
  },
  "1.4.12": {
    verify: "User-applied text spacing does not remove content or functionality.",
    test: "Apply line height 1.5 times font size, paragraph spacing 2 times, letter spacing 0.12 times, and word spacing 0.16 times, then exercise the page.",
    pass: "No text is clipped, overlapped, hidden, or made unusable after the specified spacing overrides.",
  },
  "1.4.13": {
    verify: "Additional content triggered by pointer hover or keyboard focus is dismissible, hoverable, and persistent when required.",
    test: "Trigger every tooltip, popover, submenu, and custom disclosure with pointer and keyboard. Move the pointer into it and dismiss it without moving focus.",
    pass: "The content satisfies the dismissible, hoverable, and persistent conditions unless a documented exception applies.",
  },
  "2.1.1": {
    verify: "Every function is operable through a keyboard interface, except input that depends on the path of movement.",
    test: "Put the pointer aside and complete every representative task with Tab, Shift+Tab, arrows, Enter, Space, Escape, and documented keyboard commands.",
    pass: "All actions, states, and content are reachable and operable from the keyboard with an appropriate interaction model.",
  },
  "2.1.2": {
    verify: "Keyboard focus can move into and out of every component.",
    test: "Navigate through dialogs, embedded content, editors, widgets, and custom controls in both directions and attempt to leave each component.",
    pass: "Focus is never trapped, or users receive clear instructions for a nonstandard escape method.",
  },
  "2.1.4": {
    verify: "Single-character keyboard shortcuts can be turned off, remapped, or limited to focused components.",
    test: "Identify shortcuts using only a letter, number, punctuation, or symbol and activate them while focus is outside the relevant component.",
    pass: "Each shortcut meets at least one of the turn-off, remap, or active-on-focus conditions.",
  },
  "2.2.1": {
    verify: "Users can turn off, adjust, or extend time limits unless a documented exception applies.",
    test: "Trigger session expiry, inactivity, booking, quiz, payment, and confirmation timers and inspect warnings and extension controls.",
    pass: "Users receive the required control over timing before data or task progress is lost, or the limit has a valid exception.",
  },
  "2.2.2": {
    verify: "Moving, blinking, scrolling, or auto-updating content can be paused, stopped, hidden, or controlled when required.",
    test: "Observe the page for more than five seconds and test carousels, animations, feeds, timers, tickers, and automatically changing content.",
    pass: "Applicable motion and updates provide the required user control without blocking essential operation.",
  },
  "2.3.1": {
    verify: "Content does not flash more than three times in one second unless it remains below the flash thresholds.",
    test: "Review videos, animation, transitions, error effects, and game content; use an appropriate flash-analysis tool for uncertain material.",
    pass: "No content exceeds three flashes per second or the general and red flash thresholds.",
  },
  "2.4.1": {
    verify: "Users can bypass repeated blocks and reach the main content or key regions efficiently.",
    test: "Start at the top of repeated pages and use keyboard and screen-reader navigation to bypass headers, menus, and repeated controls.",
    pass: "A working skip mechanism, landmark structure, heading structure, or equivalent method bypasses repeated blocks.",
  },
  "2.4.2": {
    verify: "Every page or view has a title that identifies its topic or purpose.",
    test: "Check browser or window titles across representative pages, dynamic routes, errors, authentication states, and multi-step flows.",
    pass: "Titles are present, descriptive, and distinguish views users may have open at the same time.",
  },
  "2.4.3": {
    verify: "Sequential keyboard focus follows an order that preserves meaning and operability.",
    test: "Tab forward and backward through the page while comparing focus movement with reading order, visual layout, dialogs, and dynamic insertions.",
    pass: "Focus reaches interactive content in a logical sequence and does not expose hidden or inert regions.",
  },
  "2.4.4": {
    verify: "Each link’s purpose can be determined from its text alone or together with its programmatically associated context.",
    test: "List links with a screen reader and inspect repeated generic labels such as ‘read more,’ image links, and links surrounding cards.",
    pass: "Users can determine each destination or action from the permitted link context, except for valid ambiguous-purpose cases.",
  },
  "2.4.5": {
    verify: "Users have more than one way to locate pages within a set, except pages that are steps or results of a process.",
    test: "Check navigation, search, sitemap, index, related links, or other discovery methods for representative pages.",
    pass: "At least two distinct location mechanisms are available for applicable pages.",
  },
  "2.4.6": {
    verify: "Headings and labels describe the topic or purpose of the content or control.",
    test: "Review headings, form labels, group labels, buttons, and instructions out of context and compare them with the action or content they identify.",
    pass: "Applicable headings and labels are clear, specific, and useful for navigation and operation.",
  },
  "2.4.7": {
    verify: "Keyboard focus is visually apparent on every operable element.",
    test: "Navigate all representative states with the keyboard and inspect the focus indicator against each background, including custom controls and dialogs.",
    pass: "A visible focus indicator is present whenever an element receives keyboard focus.",
  },
  "2.4.11": {
    verify: "A focused component is not entirely hidden by author-created content.",
    test: "Keyboard through pages with sticky headers, cookie banners, drawers, dialogs, and virtual keyboards at responsive and zoomed sizes.",
    pass: "Every focused component remains at least partially visible without requiring the user to move obstructing content.",
  },
  "2.5.1": {
    verify: "Multipoint or path-based pointer gestures have a single-pointer alternative unless the gesture is essential.",
    test: "Identify pinch, swipe, drawing, multi-finger, and path-dependent gestures and attempt the same operation with a simple tap or click sequence.",
    pass: "Each applicable function has a working single-pointer alternative or a documented essential exception.",
  },
  "2.5.2": {
    verify: "Single-pointer actions can be cancelled or undone and do not complete unexpectedly on the down-event.",
    test: "Press controls, drag away before release, release outside targets, and test undo or confirmation behavior for destructive operations.",
    pass: "Applicable actions meet at least one WCAG pointer-cancellation condition.",
  },
  "2.5.3": {
    verify: "The accessible name of a control contains the visible label text.",
    test: "Compare visible control labels with computed accessible names, especially when aria-label, icon text, or localization is used.",
    pass: "The visible label text appears in the accessible name in the same order, allowing reliable speech input.",
  },
  "2.5.4": {
    verify: "Functions triggered by device or user motion also have a user-interface alternative and motion activation can be disabled.",
    test: "Identify shake, tilt, camera gesture, or device movement features and test their settings and equivalent controls.",
    pass: "Applicable motion activation can be disabled and the same function is available without motion, unless essential or accessibility-supported.",
  },
  "2.5.7": {
    verify: "Functions requiring dragging can be completed with a single pointer without dragging unless dragging is essential.",
    test: "Test sortable lists, sliders, maps, kanban boards, upload zones, and drawing interfaces for click, tap, or discrete-control alternatives.",
    pass: "A working non-drag single-pointer method performs each applicable function.",
  },
  "2.5.8": {
    verify: "Pointer targets meet the minimum size or spacing requirement unless an exception applies.",
    test: "Measure small controls and the spacing around undersized targets in default responsive layouts, including inline links and clustered icons.",
    pass: "Targets are at least 24 by 24 CSS pixels or satisfy spacing or another documented WCAG exception.",
  },
  "3.1.1": {
    verify: "The default human language of each page can be programmatically determined.",
    test: "Inspect the root language declaration and confirm it matches the primary content across templates and localized routes.",
    pass: "A valid programmatic language is present and correctly identifies the page’s default language.",
  },
  "3.1.2": {
    verify: "Passages or phrases in another human language are programmatically identified when required.",
    test: "Review multilingual content, quotations, menus, and localized names and inspect language changes in the accessibility tree.",
    pass: "Language changes are correctly marked except for proper names, technical terms, indeterminate language, and vernacular exceptions.",
  },
  "3.2.1": {
    verify: "Receiving focus does not trigger an unexpected change of context.",
    test: "Tab to every control without activating it and observe navigation, form submission, new windows, dialogs, and major content replacement.",
    pass: "Focus alone never causes an unexpected context change.",
  },
  "3.2.2": {
    verify: "Changing a control’s setting does not trigger an unexpected context change unless users were advised beforehand.",
    test: "Change selects, radios, checkboxes, toggles, and form values and observe navigation, submission, focus movement, and new windows.",
    pass: "Input changes are predictable or the interface clearly warns users before the context changes.",
  },
  "3.2.3": {
    verify: "Repeated navigation mechanisms remain in the same relative order across a set of pages unless users initiate a change.",
    test: "Compare headers, sidebars, footers, and repeated navigation across representative templates, states, and signed-in roles.",
    pass: "Repeated navigation order is consistent or a user-initiated customization explains the difference.",
  },
  "3.2.4": {
    verify: "Components with the same function are identified consistently across a set of pages.",
    test: "Compare labels, names, icons, and descriptions for repeated actions and controls across templates and workflows.",
    pass: "Equivalent functions use consistent identification while genuinely different functions remain distinguishable.",
  },
  "3.2.6": {
    verify: "Repeated help mechanisms appear in the same relative order unless users initiate a change.",
    test: "Compare contact details, human contact, self-help, and automated contact mechanisms across the page set.",
    pass: "Applicable help mechanisms remain in a consistent relative order.",
  },
  "3.3.1": {
    verify: "Detected input errors are identified and described in text.",
    test: "Submit invalid, missing, and incorrectly formatted data in every form and review summary, inline, and programmatic error feedback.",
    pass: "Each detected error identifies the affected item and explains the problem in text.",
  },
  "3.3.2": {
    verify: "Labels or instructions are provided when user input is required.",
    test: "Review fields, required formats, constraints, examples, grouped inputs, and unfamiliar controls before and during completion.",
    pass: "Users receive the labels and instructions needed to provide valid input without relying on placeholder text alone.",
  },
  "3.3.3": {
    verify: "When an input error is detected and a correction is known, an appropriate suggestion is provided when permitted.",
    test: "Trigger format, range, date, password, address, and business-rule errors and review the actionable correction guidance.",
    pass: "Detected errors include useful suggestions unless doing so would compromise security or the content’s purpose.",
  },
  "3.3.4": {
    verify: "Legal, financial, and user-controlled data submissions can be reversed, checked, or confirmed.",
    test: "Complete applicable transactions and data changes while testing review screens, validation, confirmation, cancellation, and correction paths.",
    pass: "At least one WCAG error-prevention safeguard applies before the consequential submission is finalized.",
  },
  "3.3.7": {
    verify: "Previously entered information required again in the same process is auto-populated or selectable unless an exception applies.",
    test: "Complete multi-step and returning-user flows and note every request to re-enter information already supplied during the process.",
    pass: "Repeated information is populated or selectable, except when re-entry is essential, security-related, or no longer valid.",
  },
  "3.3.8": {
    verify: "Authentication does not depend on a cognitive-function test unless assistance or an alternative is available.",
    test: "Test sign-in, password reset, MFA, CAPTCHA, and recovery with password managers, copy and paste, and available alternatives.",
    pass: "Users can authenticate without memorizing, transcribing, or solving prohibited cognitive tests, subject to the criterion’s exceptions.",
  },
  "4.1.2": {
    verify: "User-interface components expose an accurate name and role, and their states, properties, and values are programmatically available.",
    test: "Inspect native and custom controls in the accessibility tree and operate them with a screen reader across every state change.",
    pass: "Assistive technology receives the correct name, role, value, state, and notifications of user-changeable updates.",
  },
  "4.1.3": {
    verify: "Status messages can be programmatically determined without moving focus.",
    test: "Trigger search counts, saves, cart updates, validation summaries, loading completion, and other non-modal status changes with a screen reader.",
    pass: "Applicable status messages are announced through an appropriate role or property while focus remains in context.",
  },
};

export function understandingUrl(name: string): string {
  const slug = name
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://www.w3.org/WAI/WCAG22/Understanding/${slug}.html`;
}
