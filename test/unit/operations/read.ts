import { Configuration } from '../../../src/Configuration';
import { GraphSnapshot } from '../../../src/GraphSnapshot';
import { read, write } from '../../../src/operations';
import { StaticNodeId } from '../../../src/schema';
import { query } from '../../helpers';

const { QueryRoot: QueryRootId } = StaticNodeId;

describe(`operations.read`, () => {

  const config: Configuration = {
    entityIdForNode: (node: any) => {
      return (node && node.id) ? String(node.id) : undefined;
    },
  };

  const empty = new GraphSnapshot();

  const viewerQuery = query(`{
    viewer {
      id
      name
    }
  }`);

  const parameterizedQuery = query(`query getAFoo($id: ID!) {
    user(id: $id, withExtra: true) {
      id name extra
    }
    stuff
  }`, { id: 1 });

  describe(`with an empty cache`, () => {

    it(`returns undefined when fetching anything.`, () => {
      expect(read(config, viewerQuery, empty).result).to.eq(undefined);
    });

    it(`is marked incomplete`, () => {
      expect(read(config, viewerQuery, empty).complete).to.eq(false);
    });

    it(`includes no node ids if requested`, () => {
      expect(Array.from(read(config, viewerQuery, empty, true).nodeIds)).to.have.members([]);
    });

  });

  describe(`with a complete cache`, () => {

    let snapshot: GraphSnapshot;
    beforeAll(() => {
      snapshot = write(config, empty, viewerQuery, {
        viewer: {
          id: 123,
          name: 'Foo Bar',
        },
      }).snapshot;
    });

    it(`returns the selected values.`, () => {
      const { result } = read(config, viewerQuery, snapshot);
      expect(result).to.deep.eq({
        viewer: {
          id: 123,
          name: 'Foo Bar',
        },
      });
    });

    it(`is marked complete`, () => {
      const { complete } = read(config, viewerQuery, snapshot);
      expect(complete).to.eq(true);
    });

    it(`includes all related node ids, if requested`, () => {
      const { nodeIds } = read(config, viewerQuery, snapshot, true);
      expect(Array.from(nodeIds)).to.have.members([QueryRootId, '123']);
    });

  });

  describe(`with a partial cache`, () => {

    let snapshot: GraphSnapshot;
    beforeAll(() => {
      snapshot = write(config, empty, viewerQuery, {
        viewer: {
          id: 123,
        },
      }).snapshot;
    });

    it(`returns the selected values.`, () => {
      const { result } = read(config, viewerQuery, snapshot);
      expect(result).to.deep.eq({
        viewer: {
          id: 123,
        },
      });
    });

    it(`is marked incomplete`, () => {
      const { complete } = read(config, viewerQuery, snapshot);
      expect(complete).to.eq(false);
    });

    it(`includes all related node ids, if requested`, () => {
      const { nodeIds } = read(config, viewerQuery, snapshot, true);
      expect(Array.from(nodeIds)).to.have.members([QueryRootId, '123']);
    });

  });

  describe(`with arrays of complete values`, () => {

    let snapshot: GraphSnapshot;
    beforeAll(() => {
      snapshot = write(config, empty, viewerQuery, {
        viewer: [
          { id: 1, name: 'Foo' },
          { id: 2, name: 'Bar' },
          { id: 3, name: 'Baz' },
        ],
      }).snapshot;
    });

    it(`returns the selected values.`, () => {
      const { result } = read(config, viewerQuery, snapshot);
      expect(result).to.deep.eq({
        viewer: [
          { id: 1, name: 'Foo' },
          { id: 2, name: 'Bar' },
          { id: 3, name: 'Baz' },
        ],
      });
    });

    it(`is marked complete`, () => {
      const { complete } = read(config, viewerQuery, snapshot);
      expect(complete).to.eq(true);
    });

    it(`includes all related node ids, if requested`, () => {
      const { nodeIds } = read(config, viewerQuery, snapshot, true);
      expect(Array.from(nodeIds)).to.have.members([QueryRootId, '1', '2', '3']);
    });

  });

  describe(`parameterized edges`, () => {

    describe(`with a complete cache`, () => {

      let snapshot: GraphSnapshot;
      beforeAll(() => {
        snapshot = write(config, empty, parameterizedQuery, {
          user: { id: 1, name: 'Foo', extra: true },
          stuff: 123,
        }).snapshot;
      });

      it(`returns the selected values, overlaid on the underlying data`, () => {
        const { result } = read(config, parameterizedQuery, snapshot);
        expect(result).to.deep.equal({
          user: { id: 1, name: 'Foo', extra: true },
          stuff: 123,
        });
      });

    });

    describe(`with nested edges`, () => {

      const nestedQuery = query(`query nested($id: ID!) {
        one {
          two(id: $id) {
            three {
              four(extra: true) {
                five
              }
            }
          }
        }
      }`, { id: 1 });

      let snapshot: GraphSnapshot;
      beforeAll(() => {
        snapshot = write(config, empty, nestedQuery, {
          one: {
            two: [
              {
                three: {
                  four: { five: 1 },
                },
              },
              {
                three: {
                  four: { five: 2 },
                },
              },
            ],
          },
        }).snapshot;
      });

      it(`returns the selected values, overlaid on the underlying data`, () => {
        const { result } = read(config, nestedQuery, snapshot);
        expect(result).to.deep.equal({
          one: {
            two: [
              {
                three: {
                  four: { five: 1 },
                },
              },
              {
                three: {
                  four: { five: 2 },
                },
              },
            ],
          },
        });
      });

    });

  });

});
