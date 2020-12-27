import { registerNode } from '@topology/core';
import { flowData, flowDataAnchors, flowDataIconRect, flowDataTextRect } from './data';
import { flowSubprocess, flowSubprocessIconRect, flowSubprocessTextRect } from './subprocess';
import { flowDb, flowDbIconRect, flowDbTextRect } from './db';
import { flowDocument, flowDocumentAnchors, flowDocumentIconRect, flowDocumentTextRect } from './document';
import { flowInternalStorage, flowInternalStorageIconRect, flowInternalStorageTextRect } from './internalStorage';
import {
  flowExternStorage,
  flowExternStorageAnchors,
  flowExternStorageIconRect,
  flowExternStorageTextRect
} from './externStorage';
import { flowQueue, flowQueueIconRect, flowQueueTextRect } from './queue';
import { flowManually, flowManuallyAnchors, flowManuallyIconRect, flowManuallyTextRect } from './manually';
import { flowDisplay, flowDisplayAnchors, flowDisplayIconRect, flowDisplayTextRect } from './display';
import { flowParallel, flowParallelAnchors } from './parallel';
import { flowComment, flowCommentAnchors } from './comment';

export function register() {
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
}
