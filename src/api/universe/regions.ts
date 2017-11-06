import { makeDefaultSearch } from '../../internal/search';
import { getNames, getIteratedNames } from '../../internal/names';
import { ESIAgent } from '../../internal/esi-agent';
import { Responses, esi } from '../../esi';

import * as r from '../../internal/resource-api';
import { MappedConstellations } from './constellations';
import { Market, MarketHistory } from '../market';

/**
 * The API specification for all variants that access information about an
 * region or multiple regions. This interface will not be used directly, but
 * will be filtered through some mapper, such as {@link Async} or {@link Mapped}
 * depending on what regions of ids are being accessed. However, this allows for
 * a concise and consistent specification for all variants: single, multiple,
 * and all regions.
 *
 * When mapped, each key defined in this interface becomes a function that
 * returns a Promise resolving to the key's region, or a collection related to
 * the key's region if multiple regions are being accessed at once.
 *
 * This is an API wrapper over the end points handling regions in the
 * [universe](https://esi.tech.ccp.is/latest/#/Universe) ESI endpoints.
 */
export interface RegionAPI {
  details: Responses['get_universe_regions_region_id'];
  names: string;
}

/**
 * An api adapter for accessing various details of a single in-game region,
 * specified by a provided id when the api is instantiated.
 */
export class Region extends r.impl.SimpleResource implements r.Async<RegionAPI> {
  private constellations_: MappedConstellations | undefined;
  private market_: RegionMarket | undefined;

  constructor(private agent: ESIAgent, id: number) {
    super(id);
  }

  /**
   * @returns A MappedConstellations instance tied to the constellations
   *    referenced by the details of this region
   */
  get constellations(): MappedConstellations {
    if (this.constellations_ === undefined) {
      this.constellations_ = new MappedConstellations(this.agent,
          () => this.details().then(r => r.constellations));
    }
    return this.constellations_!;
  }

  /**
   * @esi_route orders get_markets_region_id_orders [all]
   * @esi_route buyOrdersFor get_markets_region_id_orders [type, buy]
   * @esi_route sellOrdersFor get_markets_region_id_orders [type, sell]
   * @esi_route ordersFor get_markets_region_id_orders [type]
   * @esi_route types get_markets_region_id_types
   * @esi_route history get_markets_region_id_history
   *
   * @returns An API for accessing the region's market
   */
  get market(): Market & MarketHistory {
    if (this.market_ === undefined) {
      this.market_ = new RegionMarket(this.agent, this.id_);
    }
    return this.market_!;
  }

  /**
   * @returns Information about the region
   */
  details() {
    return getDetails(this.agent, this.id_);
  }

  /**
   * @esi_route ~get_universe_regions_region_id
   *
   * @returns The name of the region
   */
  names() {
    return this.details().then(result => result.name);
  }
}

/**
 * An api adapter for accessing various details of multiple region ids,
 * specified by a provided an array or set of ids when the api is instantiated.
 */
export class MappedRegions extends r.impl.SimpleMappedResource implements r.Mapped<RegionAPI> {
  constructor(private agent: ESIAgent,
      ids: number[] | Set<number> | r.impl.IDSetProvider) {
    super(ids);
  }

  /**
   * @returns Region details mapped by region id
   */
  details() {
    return this.getResource(id => getDetails(this.agent, id));
  }

  /**
   * @esi_route post_universe_names [region]
   *
   * @returns The names for each of the mapped regions
   */
  names() {
    return this.arrayIDs()
    .then(ids => getNames(this.agent, esi.universe.NameCategory.CONSTELLATION,
        ids));
  }
}

/**
 * An api adapter for accessing various details about every region in
 * the game.
 */
export class IteratedRegions extends r.impl.SimpleIteratedResource<number> implements r.Iterated<RegionAPI> {
  constructor(private agent: ESIAgent) {
    super(r.impl.makeArrayStreamer(
        () => agent.request('get_universe_regions', undefined)), id => id);
  }

  /**
   * @returns Iterator over details of all in-game regions
   */
  details() {
    return this.getResource(id => getDetails(this.agent, id));
  }

  /**
   * @esi_route post_universe_names [region]
   *
   * @returns Iterator over region names
   */
  names() {
    return getIteratedNames(this.agent, esi.universe.NameCategory.REGION,
        this.ids());
  }
}

/**
 * A functional interface for getting APIs for a specific region, a known
 * set of region ids, or every region in the game.
 */
export interface Regions {
  /**
   * Create a new region api targeting every single region in the game.
   *
   * @esi_route ids get_universe_regions
   *
   * @returns An IteratedRegions API wrapper
   */
  (): IteratedRegions;

  /**
   * Create a new region api targeting the particular region by `id`.
   *
   * @param id The region id
   * @returns An Region API wrapper for the given id
   */
  (id: number): Region;

  /**
   * Create a new region api targeting the multiple region ids. If an array is
   * provided, duplicates are removed (although the input array is not
   * modified).
   *
   * @param ids The region ids
   * @returns A MappedRegions API wrapper for the given ids
   */
  (ids: number[] | Set<number>): MappedRegions;

  /**
   * Create a new region api targeting the regions returned from a
   * search given the `query` text.
   *
   * @esi_route ids get_search [region]
   *
   * @param query The search terms
   * @param strict Whether or not the search is strict, defaults to false
   * @returns A MappedRegions API which accesses regions based on
   *    the dynamic search results
   */
  (query: string, strict?: boolean): MappedRegions;
}

/**
 * Create a new Regions instance that uses the given `agent` to
 * make its HTTP requests to the ESI interface.
 *
 * @param agent The agent making actual requests
 * @returns A Regions instance
 */
export function makeRegions(agent: ESIAgent): Regions {
  const regionSearch = makeDefaultSearch(agent, esi.SearchCategory.REGION);

  return <Regions> function (ids: number | number[] | Set<number> | string | undefined,
      strict: boolean = false) {
    if (ids === undefined) {
      // All regions since no id
      return new IteratedRegions(agent);
    } else if (typeof ids === 'number') {
      // Single id so single API
      return new Region(agent, ids);
    } else if (typeof ids === 'string') {
      // Search query for mapped API
      return new MappedRegions(agent, () => regionSearch(ids, strict));
    } else {
      // Set or array, so mapped API
      return new MappedRegions(agent, ids);
    }
  };
}

function getDetails(agent: ESIAgent, id: number) {
  return agent.request('get_universe_regions_region_id',
      { path: { region_id: id } });
}

class RegionMarket implements Market, MarketHistory {
  private orders_: r.impl.ResourceStreamer<esi.market.Order> | undefined;
  private types_: r.impl.ResourceStreamer<number> | undefined;

  constructor(private agent: ESIAgent, private id: number) {
  }

  orders() {
    if (this.orders_ === undefined) {
      this.orders_ = r.impl.makePageBasedStreamer(
          page => this.agent.request('get_markets_region_id_orders', {
            path: { region_id: this.id },
            query: { page: page, order_type: 'all' }
          })
          .then(result => ({ result, maxPages: undefined })), 10000);
    }
    return this.orders_();
  }

  buyOrdersFor(type: number) {
    return this.agent.request('get_markets_region_id_orders', {
      path: { region_id: this.id }, query: { type_id: type, order_type: 'buy' }
    });
  }

  sellOrdersFor(type: number) {
    return this.agent.request('get_markets_region_id_orders', {
      path: { region_id: this.id }, query: { type_id: type, order_type: 'sell' }
    });
  }

  ordersFor(type: number) {
    return this.agent.request('get_markets_region_id_orders', {
      path: { region_id: this.id }, query: { type_id: type, order_type: 'all' }
    });
  }

  types() {
    if (this.types_ === undefined) {
      this.types_ = r.impl.makePageBasedStreamer(
          page => this.agent.request('get_markets_region_id_types',
              { path: { region_id: this.id }, query: { page: page } })
          .then(
              result => ({result, maxPages: undefined})), 1000);
    }

    return this.types_();
  }

  history(type: number) {
    return this.agent.request('get_markets_region_id_history',
        { path: { region_id: this.id }, query: { type_id: type } });
  }
}