import contains from 'mout/array/contains';
import filter from 'mout/array/filter';
import forEach from 'mout/array/forEach';
import reject from 'mout/array/reject';
import forOwn from 'mout/object/forOwn';
import size from 'mout/object/size';
import deepClone from 'mout/lang/deepClone';
import isArray from 'mout/lang/isArray';
import isNull from 'mout/lang/isNull';
import isObject from 'mout/lang/isObject';
import isString from 'mout/lang/isString';
import isUndefined from 'mout/lang/isUndefined';
import ObjectAssign from 'object-assign';
import i18n from '../../../../core/i18n';
import '../../filter/index.tag';
import '../../operation/index.tag';
import '../../preview/index.tag';
import '../../search/index.tag';
import './operations/index.tag';

export default function() {
  const store = this.riotx.get();

  /**
   * OASに従いGETリクエストを送信します。
   * @param {Object} pagination
   * @return {Promise}
   */
  const getData = pagination => {
    if (!pagination && this.hasPagination) {
      pagination = {};
      const size = this.pagination.size;
      const current = this.pagination.current;
      pagination.limit = size;
      pagination.offset = (current - 1) * size;
    }
    const queries = ObjectAssign({}, this.searchQueries, pagination, { sort: this.sort.join(',') });
    return Promise
      .resolve()
      .then(() => {
        this.isLoading = true;
        this.update();
      })
      .then(() => Promise.all([
        // チカチカを防ぐ。
        new Promise(resolve => setTimeout(resolve, 300)),
        store.action('components.get', this.opts.id, this.opts.def, queries)
      ]))
      .then(() => {
        this.isLoading = false;
        this.update();
      })
      .catch(err => {
        this.isLoading = false;
        if (err.status === 401) {
          this.error = i18n.get('pg.components.card.table.error_401');
        } else {
          const api = this.opts.def.api;
          this.error = `[${api.method.toUpperCase()} ${api.path}]${i18n.get('pg.components.card.table.error_network')}`;
        }
        this.update();
      });
  };

  /**
   * レスポンスデータの正当性をチェックします。
   * @param {Object} data
   * @return {String|null}
   */
  const validate = data => {
    if (!isArray(data)) {
      return i18n.get('pg.components.card.table.error_response_array');
    }
    if (!data.length) {
      return i18n.get('pg.components.card.table.error_empty');
    }
    if (!isObject(data[0])) {
      return i18n.get('pg.components.card.table.error_object');
    }
    return null;
  };

  /**
   * 初期値を生成し、必要なoperationを行います。
   * @param {Object} operationObject
   * @param {Object} rowData
   */
  const createInitialValueAndOperate = (operationObject, rowData) => {
    const initialVal = {};
    // ParameterObjectから初期値を推測します。
    forEach(operationObject.parameters || [], parameterObject => {
      const name = parameterObject.name;
      const _in = parameterObject.in;
      if (_in === 'body') {
        initialVal[name] = {};
        forOwn(parameterObject.schema.properties || {}, (val, key) => {
          // undefinedとnullを省く。
          if (!isUndefined(rowData[key]) && !isNull(rowData[key])) {
            initialVal[name][key] = rowData[key];
          }
        });
      } else {
        // undefinedとnullを省く。
        if (!isUndefined(rowData[name]) && !isNull(rowData[name])) {
          initialVal[name] = rowData[name];
        }
      }
    });
    if (operationObject.isPreview) {
      openPreview(operationObject, deepClone(initialVal));
      return;
    }
    openOperationDrawer(operationObject, deepClone(initialVal));
  };

  /**
   * プレビュー画面を開きます。
   * @param {Object} operationObjct
   * @param {Object} params
   */
  const openPreview = (operationObject, params) => {
    Promise
      .resolve()
      .then(() => store.action('components.operate', operationObject, params))
      .then(res => {
        const url = res.body;
        if (!isString(url)) {
          return;
        }
        if (!!operationObject.target) {
          window.open(url, operationObject.target);
          return;
        }
        window.location.href = url;
      })
      .catch(err => store.action('modals.add', 'viron-error', {
        error: err
      }));
  };

  /**
   * 入力フォームを開きます。
   * @param {Object} operationObject
   * @param {Object} initialValue
   */
  const openOperationDrawer = (operationObject, initialVal) => {
    store.action('drawers.add', 'viron-components-page-operation', {
      operationObject,
      initialVal,
      primary: this.primary,
      onSuccess: () => {
        getData();
      }
    });
  };

  // operation数やメソッドに応じてアイコンを切り替えます。
  const getRowOperationsIcon = () => {
    const operations = this.rowOperations;
    if (!operations || operations.length !== 1) {
      return 'setting';
    }
    switch (operations[0].method) {
    case 'get':
      if (operations[0].isPreview) {
        return 'square';
      }
      return 'file';
    case 'put':
      return 'edit';
    case 'post':
      return 'plus';
    case 'delete':
      return 'remove';
    default:
      return 'setting';
    }
  };

  // 通信レスポンス内容。
  this.data = null;
  // テーブルカラム定義。
  this.columns = [];
  // 表示させるべきカラム群。filter機能でON/OFFされます。null = すべて表示。
  this.visibleColumnKeys = null;
  // テーブルに対するoperation群。
  this.tableOperations = [];
  // テーブル行に対するoperation群。
  this.rowOperations = [];
  // オペレーションアイコン。
  this.rowOperationsIcon = getRowOperationsIcon();
  // 行追加operation。
  this.postOperation = null;
  // 検索用パラメータ群。
  this.searchParameters = [];
  // primaryキー
  this.primary = null;
  // 通信中か否か。
  this.isLoading = true;
  // エラーメッセージ。
  this.error = null;
  // ページネーションが存在するか否か。
  this.hasPagination = false;
  // ページネーション情報。
  this.pagination = null;
  // ページネーションコンポーネントのボタン数。
  this.paginationSize = store.getter('layout.isDesktop') ? 5 : 3;
  // 検索クエリ群。
  this.searchQueries = {};
  forOwn(this.opts.crosssearchqueries, (value, key) => {
    if (!isUndefined(value)) {
      this.searchQueries[key] = value;
    }
  });
  this.hasSearchQueries = !!size(this.searchQueries);
  // ソート群。
  this.sort = [];
  // 自動更新間隔。
  this.autoRefreshSec = null;
  let autoRefreshIntervalId = null;
  const activateAutoRefresh = () => {
    if (!this.autoRefreshSec) {
      return;
    }
    if (autoRefreshIntervalId) {
      return;
    }
    autoRefreshIntervalId = window.setInterval(() => {
      getData();
    }, this.autoRefreshSec * 1000);
  };
  const inactivateAutoRefresh = () => {
    window.clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = null;
  };

  this.listen('layout', () => {
    this.paginationSize = store.getter('layout.isDesktop') ? 5 : 3;
    this.update();
  });
  this.listen(this.opts.id, () => {
    this.data = store.getter('components.response', this.opts.id);
    this.columns = store.getter('components.columns', this.opts.id);
    this.tableOperations = store.getter('components.operations', this.opts.id, 'table');
    this.rowOperations = store.getter('components.operations', this.opts.id, 'row');
    this.rowOperationsIcon = getRowOperationsIcon();
    this.postOperation = store.getter('components.postOperation', this.opts.id, 'table');
    this.searchParameters = store.getter('components.searchParameters', this.opts.id);
    this.primary = store.getter('components.primary', this.opts.id);
    this.error = validate(this.data);
    this.hasPagination = store.getter('components.hasPagination', this.opts.id);
    this.pagination = store.getter('components.pagination', this.opts.id);
    this.autoRefreshSec = store.getter('components.autoRefreshSec', this.opts.id);
    activateAutoRefresh();
    this.update();
  });
  this.refreshId = store.getter('util.components_refresh');
  this.listen('util', () => {
    const refreshId = store.getter('util.components_refresh');
    if (this.refreshId !== refreshId) {
      this.refreshId = refreshId;
      getData();
    }
  });

  /**
   * 表示対象カラムのみを返します。
   * @return {Array}
   */
  this.getFilteredColumns = () => {
    // nullやundefined時は全てのカラムを表示する。
    if (!this.visibleColumnKeys) {
      return this.columns;
    }
    return filter(this.columns, column => {
      return contains(this.visibleColumnKeys, column.key);
    });
  };

  /**
   * 指定されたカラムの昇順ソートがONか否か。
   * @param {String} key
   * @return {Boolean}
   */
  this.isAsc = key => {
    return contains(this.sort, `${key}:asc`);
  };

  /**
   * 指定されたカラムの降順ソートがONか否か。
   * @param {String} key
   * @return {Boolean}
   */
  this.isDesc = key => {
    return contains(this.sort, `${key}:desc`);
  };

  let prevCrossSearchQueries = ObjectAssign(this.opts.crosssearchqueries);
  this.on('mount', () => {
    getData();
  }).on('updated', () => {
    const newCrossSearchQueries = this.opts.crosssearchqueries;
    let isCrossSearchQueriesChanged = false;
    // 値が一つでも違ったらtrue。
    forOwn(newCrossSearchQueries, (value, key) => {
      if (value !== prevCrossSearchQueries[key]) {
        isCrossSearchQueriesChanged = true;
      }
    });
    // 長さが違ってもtrue。
    if (size(newCrossSearchQueries) !== size(prevCrossSearchQueries)) {
      isCrossSearchQueriesChanged = true;
    }
    // 変更があればデータ更新。
    if (isCrossSearchQueriesChanged) {
      forOwn(newCrossSearchQueries, (value, key) => {
        if (!isUndefined(value)) {
          this.searchQueries[key] = value;
        } else {
          delete this.searchQueries[key];
        }
      });
      this.hasSearchQueries = !!size(this.searchQueries);
      // 検索クエリ変更時は強制的にページ番号を1に戻す。
      if (!this.hasPagination) {
        getData();
      } else {
        const pagination = {};
        const size = this.pagination.size;
        const current = 1;
        pagination.limit = size;
        pagination.offset = (current - 1) * size;
        getData(pagination);
      }
    }
    // 次回更新用にストック。
    prevCrossSearchQueries = ObjectAssign({}, this.opts.crosssearchqueries);
  }).on('unmount', () => {
    inactivateAutoRefresh();
    store.action('components.remove', this.opts.id);
  });

  this.handlePostButtonTap = () => {
    openOperationDrawer(this.postOperation);
  };

  this.handleSearchButtonTap = () => {
    store.action('drawers.add', 'viron-components-page-search', {
      parameterObjects: this.searchParameters,
      initialVal: this.searchQueries,
      onSearch: newSearchQueries => {
        this.searchQueries = newSearchQueries;
        this.hasSearchQueries = !!size(newSearchQueries);
        // 検索クエリ変更時は強制的にページ番号を1に戻す。
        if (!this.hasPagination) {
          getData();
        } else {
          const pagination = {};
          const size = this.pagination.size;
          const current = 1;
          pagination.limit = size;
          pagination.offset = (current - 1) * size;
          getData(pagination);
        }
      }
    }, { isNarrow: true });
  };

  this.handleFilterButtonTap = () => {
    store.action('drawers.add', 'viron-components-page-filter', {
      columns: this.columns,
      selectedColumnKeys: this.visibleColumnKeys,
      onChange: newSelectedColumnKeys => {
        this.visibleColumnKeys = newSelectedColumnKeys;
        getData();
      }
    }, { isNarrow: true });
  };

  this.handleSortThTap = e => {
    const item = e.item.column;
    const key = item.key;
    // 未ソート状態であれば昇順ソートにする。
    // 既に昇順ソートされていれば、降順ソートにする。
    // 降順ソートされていれば、ソートOFFにする。
    if (this.isAsc(key)) {
      this.sort = reject(this.sort, item => (item === `${key}:asc`));
      this.sort.push(`${key}:desc`);
    } else if (this.isDesc(key)) {
      this.sort = reject(this.sort, item => (item === `${key}:desc`));
    } else {
      this.sort.push(`${key}:asc`);
    }
    // ソート更新時は強制的にページを最初に戻す。
    if (!this.hasPagination) {
      getData();
    } else {
      const pagination = {};
      const size = this.pagination.size;
      const current = 1;
      pagination.limit = size;
      pagination.offset = (current - 1) * size;
      getData(pagination);
    }

  };

  this.handleSettingButtonTap = () => {
    const rect = this.refs.settingIcon.root.getBoundingClientRect();
    store.action('popovers.add', 'viron-components-page-table-operations', {
      operations: this.tableOperations,
      onSelect: operationObject => {
        openOperationDrawer(operationObject);
      }
    }, {
      x: rect.left + (rect.width / 2),
      y: rect.bottom,
      width: 240,
      direction: 'TR'
    });
  };

  this.handleRowTap = e => {
    const name = 'preview';
    // プレビュー用に擬似的なParameterObjectsを作成する。
    const properties = {};
    forEach(this.columns, column => {
      const property = deepClone(column);
      const key = property.key;
      delete property.key;
      properties[key] = property;
    });
    const parameterObjects = [{
      'in': 'body',
      name,
      schema: {
        type: 'object',
        properties
      }
    }];
    // プレビュー用に擬似的なinitialValueを作成する。
    const dataList = [];
    forEach(this.data, data => {
      const d = {};
      d[name] = deepClone(data);
      dataList.push(d);
    });
    store.action('drawers.add', 'viron-components-page-preview', {
      parameterObjects,
      dataList,
      selectedIdx: e.item.idx,
      operations: this.rowOperations,
      onOperationSelect: (operationObject, dataListIdx) => {
        createInitialValueAndOperate(operationObject, this.data[dataListIdx]);
      }
    });
  };

  this.handleRowSettingButtonTap = e => {
    e.stopPropagation();
    const rowData = e.item.row;

    // operationが一件の場合は直接Operationドローワーを開く。
    if (this.rowOperations.length === 1) {
      createInitialValueAndOperate(this.rowOperations[0], rowData);
      return;
    }

    const elm = e.currentTarget;
    const rect = elm.getBoundingClientRect();
    Promise
      .resolve()
      .then(() => {
        this.closeAllFloats();
      })
      .then(() => {
        store.action('popovers.add', 'viron-components-page-table-operations', {
          operations: this.rowOperations,
          onSelect: operationObject => {
            createInitialValueAndOperate(operationObject, rowData);
          }
        }, {
          x: rect.left + (rect.width / 2),
          y: rect.bottom,
          width: 240,
          direction: 'TR',
          watchElm: elm
        });
      });
  };

  this.handlePaginationChange = newPage => {// eslint-disable-line no-unused-vars
    const size = this.pagination.size;
    getData({
      limit: size,
      offset: (newPage - 1) * size
    });
  };
}
