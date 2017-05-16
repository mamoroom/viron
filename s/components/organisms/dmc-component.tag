dmc-component.Component
  .Component__head
    .Component__name { component.name.get() }
    .Component__search(if="{ !!search }" onClick="{ handleSearchButtonClick }")
      dmc-icon(type="search")
  .Component__body
    .Component__spinner(if="{ isPending }")
      dmc-icon(type="loading")
    div(data-is="{ childComponentName }" if="{ !isPending }" data="{ data }" actions="{ childActions }" updater="{ updater }")
    dmc-pagination(if="{ !isPending && !!pagination }" currentPage="{ pagination.currentPage }" maxPage="{ pagination.maxPage }" size="{ 5 }" onChange="{ handlePaginationChange }")
  .Component__tail(if="{ !!selfActions }")
    dmc-component-action(each="{ action in selfActions }" action="{ action }" updater="{ parent.updater }")

  script.
    import { forEach } from 'mout/array';
    import swagger from '../../swagger';
    import constants from '../../core/constants';
    import '../organisms/dmc-component-graph-bar.tag';
    import '../organisms/dmc-component-number.tag';
    import '../organisms/dmc-component-table.tag';
    import '../organisms/dmc-pagination.tag';

    import '../atoms/dmc-icon.tag';

    const store = this.riotx.get();

    // `pending` means the status of fetching data.
    this.isPending = true;
    // `data` and others will be filled with detail info after fetching.
    this.data = {};
    this.pagination = {};
    this.search = null;
    // `component` is kind of a raw data.
    this.component = this.opts.component;
    this.selfActions = null;
    this.childActions = null;
    // used to render riot component.
    this.childComponentName = null;
    if (swagger.isComponentStyleNumber(this.component.style)) {
      this.childComponentName = 'dmc-component-number';
    } else if (swagger.isComponentStyleTable(this.component.style)) {
      this.childComponentName = 'dmc-component-table';
    } else if (swagger.isComponentStyleGraphBar(this.component.style)) {
      this.childComponentName = 'dmc-component-graph-bar';
    }
    // `updater` will be passed to the child component,(i.e. dmc-component-*) so the child component has the ability to update data.
    this.updater = (query = {}) => {
      this.isPending = true;
      this.update();
      store.action(constants.ACTION_COMPONENTS_GET, this._riot_id, this.opts.idx, query);
    };

    this.on('mount', () => {
      // TODO: debug用なので後でtimeout処理を外すこと。
      setTimeout(() => {
        this.updater();
      }, 1000);
    });

    this.on('unmount', () => {
      // TODO: state.component内の対象物を削除する？
    });

    store.change(constants.changeComponentsName(this._riot_id), (err, state, store) => {
      this.isPending = false;
      const component = store.getter(constants.GETTER_COMPONENTS_ONE, this._riot_id);
      this.data = component.data;
      this.pagination = component.pagination;
      this.search = component.search;
      this.selfActions = component.selfActions;
      this.childActions = component.childActions;
      this.update();
    });

    handleSearchButtonClick() {
      if (this.isPending) {
        return;
      }

      const queries = [];
      forEach(this.search, query => {
        queries.push({
          key: query.key.get(),
          type: query.type.get()
        });
      });
      store.action(constants.ACTION_MODAL_SHOW, 'dmc-component-searchbox', {
        queries,
        onSearch: queries => {
          this.updater(queries);
        }
      });
    }

    handlePaginationChange(page) {
      this.updater({
        limit: this.pagination.size,
        offset: (page - 1) * this.pagination.size
      });
    }

dmc-component-searchbox.Component__searchBox
  .Component__searchBoxInputs
    .Component__searchBoxInput(each="{ query in queries }")
      .Component__searchBoxInputLabel { query.key }
      dmc-input(id="{ query.key }" text="{ query.value }" placeholder="{ query.type }" onTextChange="{ parent.handleInputChange }")
  .Component__searchBoxControls
    dmc-button(label="search" onClick="{ handleSearchButtonClick }")
    dmc-button(label="cancel" type="secondary" onClick="{ handleCancelButtonClick }")

  script.
    import { find } from 'mout/array';
    import '../atoms/dmc-button.tag';

    this.queries = this.opts.queries;

    closeModal() {
      if (this.opts.isModal) {
        this.opts.modalCloser();
      }
    }

    handleInputChange(value, id) {
      const query = find(this.queries, query => {
        return (query.key === id);
      });
      if (!query) {
        return;
      }
      query.value = value;
      this.update();
    }

    handleSearchButtonClick() {
      this.closeModal();
      const ret = {};
      forEach(this.queries, query => {
        ret[query.key] = query.value;
      });
      this.opts.onSearch(ret);
    }

    handleCancelButtonClick() {
      this.closeModal();
    }

dmc-component-action.Component__action
  dmc-button(label="{ opts.action.operationId }" onClick="{ handleButtonClick }")

  script.
    import '../organisms/dmc-operation.tag';
    import '../atoms/dmc-button.tag';

    const store = this.riotx.get();

    handleButtonClick() {
      store.action(constants.ACTION_MODAL_SHOW, 'dmc-operation', {
        operation: this.opts.action,
        onSuccess: () => {
          this.opts.updater();
        }
      });
    }