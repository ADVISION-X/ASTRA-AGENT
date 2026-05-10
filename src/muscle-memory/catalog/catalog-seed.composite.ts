import type { CompositeMuscleMemoryEntry } from "./muscle-memory-catalog.schema.js";

const FORBIDDEN_VISUAL_INPUT_FIELDS = ["abilityGroupId", "childCapabilityId", "x", "y", "clientX", "clientY"];

function buildClickFirstInputContract(requiredFields: string[]) {
  return {
    requiredFields,
    optionalFields: ["targetName"],
    forbiddenFields: FORBIDDEN_VISUAL_INPUT_FIELDS,
  };
}

function buildFlowInputContract(requiredFields: string[]) {
  return {
    requiredFields,
    optionalFields: [],
    forbiddenFields: FORBIDDEN_VISUAL_INPUT_FIELDS,
  };
}

export const MUSCLE_MEMORY_COMPOSITE_SEEDS: CompositeMuscleMemoryEntry[] = [
  {
    actionCode: "LIKE_CURRENT_VIDEO",
    type: "composite",
    displayName: "Like Current Video",
    description: "Click the visible like button selected on the coordinate grid.",
    allowedForAiActionPlan: true,
    allowedForUserRequirement: false,
    sensitiveOperation: false,
    inputContract: buildClickFirstInputContract(["gridCell"]),
    steps: [
      {
        stepCode: "click-like-button",
        actionCode: "CLICK_CELL",
        inputMapping: { gridCell: "gridCell", targetName: "$const:like_button" },
        required: true,
        onFailure: "continue",
      },
    ],
    maxExpansionDepth: 3,
    successOutputRefs: ["clickResultRef"],
    failurePolicy: "continue",
  },
  {
    actionCode: "NEXT_VIDEO",
    type: "composite",
    displayName: "Next Video",
    description: "Click the visible next-video target selected on the coordinate grid.",
    allowedForAiActionPlan: true,
    allowedForUserRequirement: false,
    sensitiveOperation: false,
    inputContract: buildClickFirstInputContract(["gridCell"]),
    steps: [
      {
        stepCode: "click-next-video-target",
        actionCode: "CLICK_CELL",
        inputMapping: { gridCell: "gridCell", targetName: "$const:next_video_target" },
        required: true,
        onFailure: "continue",
      },
    ],
    maxExpansionDepth: 3,
    successOutputRefs: ["clickResultRef", "nextItemAdvanceProofRef"],
    failurePolicy: "continue",
  },
  {
    actionCode: "DISMISS_OVERLAY",
    type: "composite",
    displayName: "Dismiss Overlay",
    description: "Click the visible close or dismiss target selected on the coordinate grid.",
    allowedForAiActionPlan: true,
    allowedForUserRequirement: false,
    sensitiveOperation: false,
    inputContract: buildClickFirstInputContract(["gridCell"]),
    steps: [
      {
        stepCode: "click-close-overlay-target",
        actionCode: "CLICK_CELL",
        inputMapping: { gridCell: "gridCell", targetName: "$const:close_overlay" },
        required: true,
        onFailure: "continue",
      },
    ],
    maxExpansionDepth: 3,
    successOutputRefs: ["clickResultRef"],
    failurePolicy: "continue",
  },
  {
    actionCode: "SAVE_PRODUCT_AND_LIKE",
    type: "composite",
    displayName: "Save Product And Like",
    description: "Persist the lead record, then click the visible like button selected on the coordinate grid.",
    allowedForAiActionPlan: true,
    allowedForUserRequirement: true,
    sensitiveOperation: true,
    inputContract: buildFlowInputContract(["likeGridCell"]),
    steps: [
      { stepCode: "save-lead", actionCode: "SAVE_LEAD", inputMapping: {}, required: true, onFailure: "review_required" },
      {
        stepCode: "like-video",
        actionCode: "LIKE_CURRENT_VIDEO",
        inputMapping: { gridCell: "likeGridCell", targetName: "$const:like_button" },
        required: false,
        onFailure: "continue",
      },
    ],
    maxExpansionDepth: 4,
    successOutputRefs: ["productLeadRecordRef", "clickResultRef"],
    failurePolicy: "review_required",
  },
  {
    actionCode: "OPEN_COMMENTS",
    type: "composite",
    displayName: "Open Comments",
    description: "Click the visible comments button selected on the coordinate grid.",
    allowedForAiActionPlan: true,
    allowedForUserRequirement: false,
    sensitiveOperation: false,
    inputContract: buildClickFirstInputContract(["gridCell"]),
    steps: [
      {
        stepCode: "click-comments-button",
        actionCode: "CLICK_CELL",
        inputMapping: { gridCell: "gridCell", targetName: "$const:comments_button" },
        required: true,
        onFailure: "continue",
      },
    ],
    maxExpansionDepth: 3,
    successOutputRefs: ["clickResultRef"],
    failurePolicy: "continue",
  },
  {
    actionCode: "YES_SEEDING_VIDEO_FLOW",
    type: "composite",
    displayName: "Yes Seeding Video Flow",
    description: "Persist the lead, click like, then click the next-video target selected on the coordinate grid.",
    allowedForAiActionPlan: true,
    allowedForUserRequirement: true,
    sensitiveOperation: true,
    inputContract: buildFlowInputContract(["likeGridCell", "nextGridCell"]),
    steps: [
      { stepCode: "save-lead", actionCode: "SAVE_LEAD", inputMapping: {}, required: true, onFailure: "review_required" },
      {
        stepCode: "like-video",
        actionCode: "LIKE_CURRENT_VIDEO",
        inputMapping: { gridCell: "likeGridCell", targetName: "$const:like_button" },
        required: false,
        onFailure: "continue",
      },
      {
        stepCode: "next-video",
        actionCode: "NEXT_VIDEO",
        inputMapping: { gridCell: "nextGridCell", targetName: "$const:next_video_target" },
        required: true,
        onFailure: "continue",
      },
    ],
    maxExpansionDepth: 5,
    successOutputRefs: ["productLeadRecordRef", "clickResultRef", "nextItemAdvanceProofRef"],
    failurePolicy: "continue",
  },
  {
    actionCode: "NO_SEEDING_VIDEO_FLOW",
    type: "composite",
    displayName: "No Seeding Video Flow",
    description: "Click the visible next-video target selected on the coordinate grid and continue browsing.",
    allowedForAiActionPlan: true,
    allowedForUserRequirement: true,
    sensitiveOperation: false,
    inputContract: buildFlowInputContract(["nextGridCell"]),
    steps: [
      {
        stepCode: "next-video",
        actionCode: "NEXT_VIDEO",
        inputMapping: { gridCell: "nextGridCell", targetName: "$const:next_video_target" },
        required: true,
        onFailure: "continue",
      },
    ],
    maxExpansionDepth: 3,
    successOutputRefs: ["clickResultRef", "nextItemAdvanceProofRef"],
    failurePolicy: "continue",
  },
];