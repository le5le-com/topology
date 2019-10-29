import { Topology } from '../../libs/topology';
import { registerNode } from '../../libs/topology/middles';
import { Pen } from '../../libs/topology/models/pen';
import { Node } from '../../libs/topology/models/node';
import { Point } from '../../libs/topology/models/point';
import { Line } from '../../libs/topology/models/line';
import { Rect } from '../../libs/topology/models/rect';
import { Store, Observer } from 'le5le-store';
import { s8 } from '../../libs/topology/uuid/uuid';

import {
  flowData,
  flowDataAnchors,
  flowDataIconRect,
  flowDataTextRect,
  flowSubprocess,
  flowSubprocessIconRect,
  flowSubprocessTextRect,
  flowDb,
  flowDbIconRect,
  flowDbTextRect,
  flowDocument,
  flowDocumentAnchors,
  flowDocumentIconRect,
  flowDocumentTextRect,
  flowInternalStorage,
  flowInternalStorageIconRect,
  flowInternalStorageTextRect,
  flowExternStorage,
  flowExternStorageAnchors,
  flowExternStorageIconRect,
  flowExternStorageTextRect,
  flowQueue,
  flowQueueIconRect,
  flowQueueTextRect,
  flowManually,
  flowManuallyAnchors,
  flowManuallyIconRect,
  flowManuallyTextRect,
  flowDisplay,
  flowDisplayAnchors,
  flowDisplayIconRect,
  flowDisplayTextRect,
  flowParallel,
  flowParallelAnchors,
  flowComment,
  flowCommentAnchors
} from '../../libs/topology-flow-diagram';

import {
  activityFinal,
  activityFinalIconRect,
  activityFinalTextRect,
  swimlaneV,
  swimlaneVIconRect,
  swimlaneVTextRect,
  swimlaneH,
  swimlaneHIconRect,
  swimlaneHTextRect,
  fork,
  forkHAnchors,
  forkIconRect,
  forkTextRect,
  forkVAnchors
} from '../../libs/topology-activity-diagram';
import {
  simpleClass,
  simpleClassIconRect,
  simpleClassTextRect,
  interfaceClass,
  interfaceClassIconRect,
  interfaceClassTextRect
} from '../../libs/topology-class-diagram';
import {
  lifeline,
  lifelineAnchors,
  lifelineIconRect,
  lifelineTextRect,
  sequenceFocus,
  sequenceFocusAnchors,
  sequenceFocusIconRect,
  sequenceFocusTextRect
} from '../../libs/topology-sequence-diagram';

// Register flow diagrams.
registerNode('flowData', flowData, flowDataAnchors, flowDataIconRect, flowDataTextRect);
registerNode('flowSubprocess', flowSubprocess, null, flowSubprocessIconRect, flowSubprocessTextRect);
registerNode('flowDb', flowDb, null, flowDbIconRect, flowDbTextRect);
registerNode('flowDocument', flowDocument, flowDocumentAnchors, flowDocumentIconRect, flowDocumentTextRect);
registerNode(
  'flowInternalStorage',
  flowInternalStorage,
  null,
  flowInternalStorageIconRect,
  flowInternalStorageTextRect
);
registerNode(
  'flowExternStorage',
  flowExternStorage,
  flowExternStorageAnchors,
  flowExternStorageIconRect,
  flowExternStorageTextRect
);
registerNode('flowQueue', flowQueue, null, flowQueueIconRect, flowQueueTextRect);
registerNode('flowManually', flowManually, flowManuallyAnchors, flowManuallyIconRect, flowManuallyTextRect);
registerNode('flowDisplay', flowDisplay, flowDisplayAnchors, flowDisplayIconRect, flowDisplayTextRect);
registerNode('flowParallel', flowParallel, flowParallelAnchors, null, null);
registerNode('flowComment', flowComment, flowCommentAnchors, null, null);

// activity
registerNode('activityFinal', activityFinal, null, activityFinalIconRect, activityFinalTextRect);
registerNode('swimlaneV', swimlaneV, null, swimlaneVIconRect, swimlaneVTextRect);
registerNode('swimlaneH', swimlaneH, null, swimlaneHIconRect, swimlaneHTextRect);
registerNode('forkH', fork, forkHAnchors, forkIconRect, forkTextRect);
registerNode('forkV', fork, forkVAnchors, forkIconRect, forkTextRect);

// class
registerNode('simpleClass', simpleClass, null, simpleClassIconRect, simpleClassTextRect);
registerNode('interfaceClass', interfaceClass, null, interfaceClassIconRect, interfaceClassTextRect);

// sequence
registerNode('lifeline', lifeline, lifelineAnchors, lifelineIconRect, lifelineTextRect);
registerNode('sequenceFocus', sequenceFocus, sequenceFocusAnchors, sequenceFocusIconRect, sequenceFocusTextRect);
// end.

(window as any).Le5leTopology = {
  Topology,
  registerNode,
  Pen,
  Node,
  Point,
  Line,
  Rect,
  Store,
  Observer,
  s8
};
