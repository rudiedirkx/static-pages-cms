"use strict";

class CmsWidget {
	prepareOptions(options) {
	}

	create(field, parents = []) {
	}

	created($field, field) {
	}

	getValue($field, field, cms) {
	}

	setValue($field, field, val) {
	}

	createInput(type) {
		const el = document.createElement('input');
		el.type = type || 'text';
		return el;
	}
}

class CmsWidgetInput extends CmsWidget {
	constructor(type) {
		super();
		this.type = type;
	}

	create(field, parents = []) {
		return this.createInput(this.type);
	}

	getValue($field, field, cms) {
		return $field.querySelector('input').value;
	}

	setValue($field, field, val) {
		return $field.querySelector('input').value = val == null ? '' : val;
	}
}

class CmsWidgetNumber extends CmsWidgetInput {
	constructor() {
		super('number');
	}

	getValue($field, field, cms) {
		const val = super.getValue($field, field, cms);
		return val === '' ? null : parseFloat(val);
	}
}

class CmsWidgetBoolean extends CmsWidgetInput {
	create(field, parents = []) {
		return this.createInput('checkbox');
	}

	getValue($field, field, cms) {
		return $field.querySelector('input').checked;
	}

	setValue($field, field, val) {
		return $field.querySelector('input').checked = val === true;
	}
}

class CmsWidgetFile extends CmsWidget {
	create(field, parents = []) {
		const div = document.createElement('div');
		div.append(document.createElement('output'));
		div.append(' ');
		div.append(this.createInput('file'));
		return div;
	}

	getValue($field, field, cms) {
		const file = $field.querySelector('input').files[0];
		const curr = $field.querySelector('output').value;
		return file ? cms.newFile(file) : curr;
	}

	setValue($field, field, val) {
		return $field.querySelector('output').value = val || '';
	}
}

class CmsWidgetImage extends CmsWidgetFile {
	create(field, parents = []) {
		const div = super.create(field, parents);
		div.querySelector('input').accept = 'image/*';
		return div;
	}
}

class CmsWidgetSelect extends CmsWidget {
	prepareOptions(field) {
		if (field.options instanceof Array) {
			field.options = field.options.map(opt => {
				return typeof opt == 'string' ? {value: opt} : opt;
			});
		}
		else if (typeof field.options == 'object') {
			field.options = Object.entries(field.options).map(([value, label]) => {
				return {value, label};
			});
		}
	}

	create(field, parents = []) {
		const sel = document.createElement('select');
		[{value: '', label: '--'}, ...(field.options || [])].forEach(opt => {
			const el = document.createElement('option');
			el.value = opt.value || opt.label;
			el.textContent = opt.label || opt.value;
			sel.append(el);
		});
		return sel;
	}

	getValue($field, field, cms) {
		return $field.querySelector('select').value;
	}

	setValue($field, field, val) {
		return $field.querySelector('select').value = val == null ? '' : val;
	}
}

class CmsWidgetText extends CmsWidget {
	create(field, parents = []) {
		const el = document.createElement('textarea');
		return el;
	}

	getValue($field, field, cms) {
		return $field.querySelector('textarea').value;
	}

	setValue($field, field, val) {
		return $field.querySelector('textarea').value = val == null ? '' : val;
	}
}

class CmsWidgetHidden extends CmsWidgetText {
	created($field, field) {
		$field.hidden = true;
	}
}

class CmsWidgetMarkdown extends CmsWidgetText {
}

class CmsWidgetList extends CmsWidget {
	static ONLY_NAME = '__value';

	create(field, parents = []) {
		return CmsUI.createFieldset(field.fields, {
			title: `Item 1`,
			className: 'item',
			parents,
		});
	}

	created($field, field) {
		this.addCount($field);
		CmsUI.insertAfterSpace($field.querySelector('.legend'), this.makeAddButton($field, field));
		this.addRemove($field.querySelector('.item'), field);
		if (field.fields[CmsWidgetList.ONLY_NAME]) {
			$field.querySelector(':scope > .item > .widget').classList.add('structure');
		}
		$field.append(this.makeAddButton($field, field));
	}

	addCount($field) {
		const leg = $field.querySelector('.legend');
		const ct = document.createElement('span');
		ct.classList.add('item-count');
		ct.textContent = 1;
		leg.append(' (');
		leg.append(ct);
		leg.append(') ');
	}

	updateCount($field) {
		const items = $field.querySelectorAll(':scope > .item');
		const ct = $field.querySelector('.item-count');
		ct.textContent = items.length;
	}

	makeAddButton($field, field) {
		const btn = document.createElement('button');
		btn.textContent = '+';
		btn.title = `Add one ${field.label_singular || field.label}`;
		btn.onclick = e => {
			e.preventDefault();
			this.addItem($field, field);
		};
		return btn;
	}

	addItem($field, field) {
		const parents = $field.closest('.widget').dataset.fullname.split('/');
		const num = $field.querySelectorAll(':scope > .item').length+1;
		const $item = CmsUI.createFieldset(field.fields, {
			title: `Item ${num}`,
			className: 'item',
			parents,
		});
		this.addRemove($item, field);
		if (field.fields[CmsWidgetList.ONLY_NAME]) {
			$item.querySelector('.widget').classList.add('structure');
		}
		$field.append($item);
		$field.append($field.querySelector('.legend ~ button'))
		this.updateCount($field);
		return $item;
	}

	addRemove($field) {
		const btn = document.createElement('button');
		btn.textContent = 'x';
		btn.onclick = e => {
			e.preventDefault();
			const $field = e.target.closest('.widget');
			e.target.closest('.item').remove();
			this.updateCount($field);
		};

		CmsUI.insertAfterSpace($field.querySelector('.legend'), btn);
	}

	getValue($field, field, cms) {
		const items = Array.from($field.querySelectorAll(':scope > .item'));
		return items.map($item => {
			const values = CmsUI.getFieldsetValues($item, cms);
			return field.fields[CmsWidgetList.ONLY_NAME] ? values[CmsWidgetList.ONLY_NAME] : values;
		});
	}

	setValue($field, field, value) {
		if (!value || !value.length) return;

		$field.querySelectorAll(':scope > .item').forEach($item => $item.remove());

		const L = value.length || 1;
		for ( let n = 0; n < L; n++ ) {
			const $item = this.addItem($field, field);
			CmsUI.setFieldsetValues($item, field.fields[CmsWidgetList.ONLY_NAME] ? {[CmsWidgetList.ONLY_NAME]: value[n]} : value[n]);
		}
	}
}

class CmsWidgetObject extends CmsWidget {
	create(field, parents = []) {
		return CmsUI.createFieldset(field.fields, {parents});
	}

	getValue($field, field, cms) {
		return CmsUI.getFieldsetValues($field.querySelector('.structure'), cms);
	}

	setValue($field, field, value) {
		CmsUI.setFieldsetValues($field.querySelector('.structure'), value || {});
	}
}

const WIDGETS = {
	"hidden": new CmsWidgetHidden(),
	"string": new CmsWidgetInput('text'),
	"date": new CmsWidgetInput('date'),
	"datetime": new CmsWidgetInput('datetime'),
	"number": new CmsWidgetNumber(),
	"boolean": new CmsWidgetBoolean('checkbox'),
	"file": new CmsWidgetFile(),
	"image": new CmsWidgetImage(),
	"select": new CmsWidgetSelect(),
	"text": new CmsWidgetText(),
	"markdown": new CmsWidgetText(),
	"list": new CmsWidgetList(),
	"object": new CmsWidgetObject(),
};
