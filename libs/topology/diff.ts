import DeepDiff from 'deep-diff';
import { TopologyData } from './models/data';
import { Pen } from './models/pen';

/**
 *
 * @param oldData olddata from cache
 * @param newData newdata from canvas.data
 */
export function diffData(oldData: TopologyData, newData: TopologyData): TopologyData {
  const oldPens = oldData.pens, newPens = newData.pens;
  const oldIds: { [key: string]: Pen } = {}, newIds: { [key: string]: Pen } = {};
  newPens.forEach(pen => {
    newIds[pen.id] = pen;
  });
  oldPens.forEach(pen => {
    oldIds[pen.id] = pen;
  });
  // https://github.com/flitbit/diff
  const differences = DeepDiff(oldIds, newIds);
  if (differences) {
    const realDiff = differences.filter(d => {
      //ignore dockWatchers
      return !d.path.includes('dockWatchers');
    }).filter(d => {
      // N - indicates a newly added property/element
      if (d.kind === 'N') {
        return (d.rhs !== undefined) && (d.rhs !== null);
      } else {
        // D - indicates a property/element was deleted
        // E - indicates a property/element was edited
        // A - indicates a change occurred within an array
        return d;
      }
    });
    const diffIds = {};
    realDiff.forEach(d => {
      const id = d.path[0];
      diffIds[id] = id;
    });

    const pens = [];
    newPens.forEach(pen => {
      const { id } = pen;
      // N - indicates a newly added property/element
      // D - indicates a property/element was deleted
      // E - indicates a property/element was edited
      // A - indicates a change occurred within an array
      // && newIds[id]  ,It is possible to delete the node and make sure that there is
      if (diffIds[id] && newIds[id]) {
        pens.push(pen.clone());
      } else {
        //Multiplex pen
        pens.push(oldIds[id]);
      }
    });
    const options = Object.assign({}, newData, { pens: [] });
    const data = new TopologyData(options);
    data.pens = pens;
    return data;
  }
  return oldData;
}
