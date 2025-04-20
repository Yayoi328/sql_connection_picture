document.addEventListener('DOMContentLoaded', function() {
  const sqlInput = document.getElementById('sql-input');
  const generateBtn = document.getElementById('generate-btn');
  const loadingElement = document.getElementById('loading');
  const errorMessageElement = document.getElementById('error-message');
  const graphContainer = document.getElementById('graph-container');
  const graphElement = document.getElementById('graph');

  // 示例SQL
  const exampleSQL = "SELECT users.id, users.name, orders.order_date, orders.total \n" +
                     "FROM users \n" +
                     "JOIN orders ON users.id = orders.user_id \n" +
                     "WHERE orders.status = 'completed' \n" +
                     "ORDER BY orders.order_date DESC";
  
  sqlInput.value = exampleSQL;

  generateBtn.addEventListener('click', function() {
    const sql = sqlInput.value.trim();
    
    if (!sql) {
      showError('请输入SQL语句');
      return;
    }
    
    // 显示加载状态
    showLoading();
    hideError();
    
    // 使用setTimeout模拟异步处理，让加载状态可见
    setTimeout(() => {
      try {
        // 解析SQL
        const parsedSQL = parseSql(sql);
        
        // 生成关系图数据
        const graphData = generateGraphData(parsedSQL);
        
        // 绘制关系图
        renderGraph(graphData);
        
        // 显示关系图容器
        graphContainer.classList.remove('hidden');
        
        // 隐藏加载状态
        hideLoading();
      } catch (error) {
        console.error('解析SQL错误:', error);
        hideLoading();
        showError(`无法解析SQL: ${error.message}`);
      }
    }, 500);
  });

  // 全局保存最后一次使用的表别名映射
  let lastTableAliases = new Map();

  /**
   * 解析SQL语句
   * @param {string} sql - SQL语句
   * @returns {Object} - 解析结果
   */
  function parseSql(sql) {
    try {
      // 检查SQL解析库是否正确加载
      if (typeof window.sqlParser === 'function') {
        // 使用sqlParser函数解析SQL
        const ast = window.sqlParser(sql);
        console.log('SQL AST:', ast);
        return ast;
      } else if (typeof window.SQLParser !== 'undefined' && typeof window.SQLParser.parse === 'function') {
        // 使用SQLParser.parse方法解析SQL
        const ast = window.SQLParser.parse(sql);
        console.log('SQL AST:', ast);
        return ast;
      } else {
        // 使用简单的自定义解析器作为备选方案
        const simpleParsedResult = simpleParseSQL(sql);
        console.log('简单解析SQL结果:', simpleParsedResult);
        return simpleParsedResult;
      }
    } catch (error) {
      console.error('SQL解析错误:', error);
      // 使用简单的自定义解析器作为备选方案
      const simpleParsedResult = simpleParseSQL(sql);
      console.log('使用备选解析器:', simpleParsedResult);
      return simpleParsedResult;
    }
  }

  /**
   * 简单的SQL解析函数，用作备选方案
   * @param {string} sql - SQL语句
   * @returns {Object} - 解析结果
   */
  function simpleParseSQL(sql) {
    const result = {
      SELECT: {
        result_columns: [],
        FROM: [],
        JOIN: [],
        WHERE: null
      }
    };

    // 转换为小写并移除多余空格
    const normalizedSQL = sql.trim();
    
    // 提取表名
    const fromRegex = /from\s+([a-z0-9_\.\[\]"`]+)(?:\s+as\s+([a-z0-9_]+))?/gi;
    let fromMatch;
    while ((fromMatch = fromRegex.exec(normalizedSQL)) !== null) {
      const tableName = fromMatch[1].replace(/[\[\]"`]/g, '');
      const tableAlias = fromMatch[2] || '';
      
      result.SELECT.FROM.push({
        table: tableName,
        as: tableAlias
      });
    }
    
    // 提取JOIN
    const joinRegex = /join\s+([a-z0-9_\.\[\]"`]+)(?:\s+as\s+([a-z0-9_]+))?\s+on\s+(.*?)(?=\s+(?:where|group|order|limit|$))/gi;
    let joinMatch;
    while ((joinMatch = joinRegex.exec(normalizedSQL)) !== null) {
      const tableName = joinMatch[1].replace(/[\[\]"`]/g, '');
      const tableAlias = joinMatch[2] || '';
      const joinCondition = joinMatch[3].trim();
      
      // 解析JOIN条件
      const onParts = joinCondition.split(/\s*=\s*/);
      let leftPart = onParts[0] || '';
      let rightPart = onParts[1] || '';
      
      const leftPartSplit = leftPart.split('.');
      const rightPartSplit = rightPart.split('.');
      
      const joinOn = {
        left: {
          table: leftPartSplit.length > 1 ? leftPartSplit[0] : '',
          column: leftPartSplit.length > 1 ? leftPartSplit[1] : leftPartSplit[0]
        },
        right: {
          table: rightPartSplit.length > 1 ? rightPartSplit[0] : '',
          column: rightPartSplit.length > 1 ? rightPartSplit[1] : rightPartSplit[0]
        }
      };
      
      result.SELECT.JOIN.push({
        table: tableName,
        as: tableAlias,
        ON: joinOn
      });
    }
    
    // 提取选择的列
    const selectRegex = /select\s+(.*?)(?=\s+from)/gi;
    const selectMatch = selectRegex.exec(normalizedSQL);
    if (selectMatch) {
      const columns = selectMatch[1].split(',');
      
      columns.forEach(column => {
        const trimmedColumn = column.trim();
        const asMatch = /^(.*?)\s+as\s+(.*?)$/i.exec(trimmedColumn);
        
        if (asMatch) {
          const colExpression = asMatch[1].trim();
          const colAlias = asMatch[2].trim();
          
          const colParts = colExpression.split('.');
          
          result.SELECT.result_columns.push({
            expr: {
              type: 'column',
              table: colParts.length > 1 ? colParts[0] : '',
              column: colParts.length > 1 ? colParts[1] : colParts[0]
            },
            as: colAlias
          });
        } else {
          const colParts = trimmedColumn.split('.');
          
          result.SELECT.result_columns.push({
            expr: {
              type: 'column',
              table: colParts.length > 1 ? colParts[0] : '',
              column: colParts.length > 1 ? colParts[1] : colParts[0]
            }
          });
        }
      });
    }
    
    // 提取WHERE条件
    const whereRegex = /where\s+(.*?)(?=\s+(?:group|order|limit|$))/gi;
    const whereMatch = whereRegex.exec(normalizedSQL);
    if (whereMatch) {
      const whereCondition = whereMatch[1].trim();
      
      // 简单解析WHERE条件
      const conditionParts = whereCondition.split(/\s+and\s+|\s+or\s+/i);
      
      const parseCondition = (condition) => {
        const operatorMatch = /([^<>=!]+)([<>=!]{1,2})([^<>=!]+)/i.exec(condition);
        
        if (operatorMatch) {
          const leftSide = operatorMatch[1].trim();
          const operator = operatorMatch[2].trim();
          const rightSide = operatorMatch[3].trim();
          
          const leftParts = leftSide.split('.');
          
          return {
            left: {
              table: leftParts.length > 1 ? leftParts[0] : '',
              column: leftParts.length > 1 ? leftParts[1] : leftParts[0]
            },
            operator: operator,
            right: {
              type: 'literal',
              literal: rightSide.replace(/^'|'$/g, '')
            }
          };
        }
        
        return null;
      };
      
      if (conditionParts.length > 0) {
        result.SELECT.WHERE = parseCondition(conditionParts[0]);
      }
    }
    
    return result;
  }

  /**
   * 从解析结果生成关系图数据
   * @param {Object} parsedSQL - 解析后的SQL AST
   * @returns {Object} - 图数据结构
   */
  function generateGraphData(parsedSQL) {
    // 添加调试信息
    console.log('生成图表数据，解析SQL结果:', parsedSQL);
    
    // 初始化图数据
    const graphData = {
      nodes: [],
      links: []
    };
    
    // 数据结构
    const tables = new Set(); // 所有表名
    const tableFields = new Map(); // 表名 -> 字段集合
    const resultFields = new Set(); // 查询结果包含的字段
    const joinRelations = []; // 表之间的JOIN关系 [{source: 表1, target: 表2, condition: 连接条件}]
    
    // 表别名映射
    const tableAliases = new Map(); // 别名 -> 实际表名
    
    // 额外保存原表名和别名的显示信息
    const tableDisplayNames = new Map(); // 表名/别名 -> 显示名称
    const fieldDisplayNames = new Map(); // 字段ID -> 显示名称
    
    try {
      // 检查是否有解析结果
      if (!parsedSQL) {
        throw new Error('SQL解析结果为空');
      }
      
      // 处理不同解析库可能返回的不同结构
      let sqlSelect = null;
      
      // 对于js-sql-parser的AST结构
      if (parsedSQL.ast && parsedSQL.ast.type === 'select') {
        sqlSelect = parsedSQL.ast;
        console.log('检测到js-sql-parser AST格式');
      } 
      // 对于sql-parser-mistic的AST结构
      else if (parsedSQL.SELECT) {
        sqlSelect = parsedSQL.SELECT;
        console.log('检测到sql-parser-mistic AST格式');
      }
      // 对于自定义解析器的AST结构
      else if (parsedSQL.select || parsedSQL.from) {
        sqlSelect = parsedSQL;
        console.log('检测到其他AST格式');
      }
      
      if (!sqlSelect) {
        throw new Error('无法识别SQL解析结果格式');
      }
      
      console.log('处理SQL Select语句:', sqlSelect);
      
      // 为嵌套函数定义提前定义所有变量引用（闭包捕获）
      // 这确保嵌套函数可以访问外部作用域中定义的变量
      const accessToTables = tables;
      const accessToTableFields = tableFields;
      const accessToTableAliases = tableAliases;
      const accessToTableDisplayNames = tableDisplayNames;
      const accessToFieldDisplayNames = fieldDisplayNames;
      
      // 从WHERE子句中提取字段
      function extractFieldsFromWhere(whereClause) {
        console.log('处理WHERE子句:', whereClause);
        
        if (!whereClause) return;
        
        // 递归遍历WHERE条件
        function traverse(node) {
          if (!node) return;
          
          if (node.left) {
            if (node.left.table || node.left.column) {
              // sql-parser-mistic格式
              const tableName = node.left.table || '';
              const fieldName = node.left.column;
              
              if (fieldName) {
                // 如果指定了表
                if (tableName) {
                  const actualTable = accessToTableAliases.get(tableName) || tableName;
                  if (accessToTableFields.has(actualTable)) {
                    accessToTableFields.get(actualTable).add(fieldName);
                  }
                  if (accessToTableFields.has(tableName)) {
                    accessToTableFields.get(tableName).add(fieldName);
                  }
                } else if (accessToTables.size === 1) {
                  // 如果只有一个表，直接添加
                  const singleTable = Array.from(accessToTables)[0];
                  accessToTableFields.get(singleTable).add(fieldName);
                }
              }
            } else if (node.left.type === 'column_ref') {
              // js-sql-parser格式
              let fullColumn = node.left.column;
              if (fullColumn.indexOf('.') > -1) {
                const parts = fullColumn.split('.');
                const tableName = parts[0];
                const fieldName = parts[1];
                
                if (tableName && fieldName) {
                  const actualTable = accessToTableAliases.get(tableName) || tableName;
                  if (accessToTableFields.has(actualTable)) {
                    accessToTableFields.get(actualTable).add(fieldName);
                  }
                  if (accessToTableFields.has(tableName)) {
                    accessToTableFields.get(tableName).add(fieldName);
                  }
                }
              }
            }
            
            // 递归处理left
            if (typeof node.left === 'object' && !node.left.column) {
              traverse(node.left);
            }
          }
          
          if (node.right) {
            if (node.right.table || node.right.column) {
              // sql-parser-mistic格式
              const tableName = node.right.table || '';
              const fieldName = node.right.column;
              
              if (fieldName) {
                if (tableName) {
                  const actualTable = accessToTableAliases.get(tableName) || tableName;
                  if (accessToTableFields.has(actualTable)) {
                    accessToTableFields.get(actualTable).add(fieldName);
                  }
                  if (accessToTableFields.has(tableName)) {
                    accessToTableFields.get(tableName).add(fieldName);
                  }
                } else if (accessToTables.size === 1) {
                  const singleTable = Array.from(accessToTables)[0];
                  accessToTableFields.get(singleTable).add(fieldName);
                }
              }
            } else if (node.right.type === 'column_ref') {
              // js-sql-parser格式
              let fullColumn = node.right.column;
              if (fullColumn.indexOf('.') > -1) {
                const parts = fullColumn.split('.');
                const tableName = parts[0];
                const fieldName = parts[1];
                
                if (tableName && fieldName) {
                  const actualTable = accessToTableAliases.get(tableName) || tableName;
                  if (accessToTableFields.has(actualTable)) {
                    accessToTableFields.get(actualTable).add(fieldName);
                  }
                  if (accessToTableFields.has(tableName)) {
                    accessToTableFields.get(tableName).add(fieldName);
                  }
                }
              }
            }
            
            // 递归处理right
            if (typeof node.right === 'object' && !node.right.column) {
              traverse(node.right);
            }
          }
        }
        
        traverse(whereClause);
      }
      
      // 从JOIN条件中提取连接关系
      function extractJoinRelation(joinCondition) {
        if (!joinCondition) return null;
        
        console.log('提取JOIN关系:', joinCondition);
        
        try {
          let leftTable = '';
          let leftField = '';
          let rightTable = '';
          let rightField = '';
          let conditionText = '';
          
          // sql-parser-mistic格式
          if (joinCondition.left && joinCondition.right) {
            if (joinCondition.left.table && joinCondition.left.column) {
              leftTable = joinCondition.left.table;
              leftField = joinCondition.left.column;
            } else if (joinCondition.left.column && joinCondition.left.column.indexOf('.') > -1) {
              const parts = joinCondition.left.column.split('.');
              leftTable = parts[0];
              leftField = parts[1];
            }
            
            if (joinCondition.right.table && joinCondition.right.column) {
              rightTable = joinCondition.right.table;
              rightField = joinCondition.right.column;
            } else if (joinCondition.right.column && joinCondition.right.column.indexOf('.') > -1) {
              const parts = joinCondition.right.column.split('.');
              rightTable = parts[0];
              rightField = parts[1];
            }
            
            // 格式化条件文本 - 使用原始表名和字段名
            const leftTableOriginal = accessToTableAliases.get(leftTable) || leftTable;
            const rightTableOriginal = accessToTableAliases.get(rightTable) || rightTable;
            
            // 条件文本使用别名格式（如有）
            conditionText = `${leftTable}.${leftField} = ${rightTable}.${rightField}`;
            
            // 额外保存原始表名信息，用于后面显示
            const leftFullField = `${leftTableOriginal}.${leftField}`;
            const rightFullField = `${rightTableOriginal}.${rightField}`;
            
            // 保存字段的显示名称
            if (leftTable !== leftTableOriginal) {
              accessToFieldDisplayNames.set(`field:${leftTableOriginal}.${leftField}`, 
                `${leftField} (${leftFullField})`);
            }
            
            if (rightTable !== rightTableOriginal) {
              accessToFieldDisplayNames.set(`field:${rightTableOriginal}.${rightField}`, 
                `${rightField} (${rightFullField})`);
            }
          } 
          // js-sql-parser格式
          else if (joinCondition.type === 'binary_expr' && joinCondition.operator === '=') {
            if (joinCondition.left.type === 'column_ref' && joinCondition.left.column.indexOf('.') > -1) {
              const parts = joinCondition.left.column.split('.');
              leftTable = parts[0];
              leftField = parts[1];
            }
            
            if (joinCondition.right.type === 'column_ref' && joinCondition.right.column.indexOf('.') > -1) {
              const parts = joinCondition.right.column.split('.');
              rightTable = parts[0];
              rightField = parts[1];
            }
            
            // 格式化条件文本 - 使用原始表名和字段名
            const leftTableOriginal = accessToTableAliases.get(leftTable) || leftTable;
            const rightTableOriginal = accessToTableAliases.get(rightTable) || rightTable;
            
            // 条件文本使用别名格式（如有）
            conditionText = `${leftTable}.${leftField} = ${rightTable}.${rightField}`;
            
            // 额外保存原始表名信息，用于后面显示
            const leftFullField = `${leftTableOriginal}.${leftField}`;
            const rightFullField = `${rightTableOriginal}.${rightField}`;
            
            // 保存字段的显示名称
            if (leftTable !== leftTableOriginal) {
              accessToFieldDisplayNames.set(`field:${leftTableOriginal}.${leftField}`, 
                `${leftField} (${leftFullField})`);
            }
            
            if (rightTable !== rightTableOriginal) {
              accessToFieldDisplayNames.set(`field:${rightTableOriginal}.${rightField}`, 
                `${rightField} (${rightFullField})`);
            }
          }
          
          if (leftTable && leftField && rightTable && rightField) {
            return {
              leftTable,
              leftField,
              rightTable,
              rightField,
              condition: conditionText,
              // 添加原始表名信息
              leftTableOriginal: accessToTableAliases.get(leftTable) || leftTable,
              rightTableOriginal: accessToTableAliases.get(rightTable) || rightTable
            };
          }
        } catch (e) {
          console.error('提取JOIN关系出错:', e);
        }
        
        return null;
      }
      
      // 处理FROM
      let fromItems = [];
      if (sqlSelect.FROM) {
        fromItems = sqlSelect.FROM;
      } else if (sqlSelect.from) {
        // js-sql-parser格式
        fromItems = Array.isArray(sqlSelect.from) ? sqlSelect.from : [sqlSelect.from];
      }
      
      console.log('处理FROM子句:', fromItems);
      
      // 提取表信息
      fromItems.forEach(fromItem => {
        let tableName = '';
        let alias = '';
        
        // 处理不同解析器的FROM结构
        if (fromItem.table) {
          tableName = fromItem.table;
          alias = fromItem.as || '';
        } else if (fromItem.name) {
          tableName = fromItem.name.value || fromItem.name;
          if (fromItem.alias) {
            alias = fromItem.alias.value || fromItem.alias;
          }
        } else if (typeof fromItem === 'string') {
          tableName = fromItem;
        }
        
        if (tableName) {
          tables.add(tableName);
          
          // 初始化表的字段集合
          if (!tableFields.has(tableName)) {
            tableFields.set(tableName, new Set());
          }
          
          // 记录表别名映射
          if (alias) {
            tableAliases.set(alias, tableName);
            
            // 也初始化别名的字段集合（后面合并）
            if (!tableFields.has(alias)) {
              tableFields.set(alias, new Set());
            }
            
            // 存储表的显示名称 - 带别名格式
            tableDisplayNames.set(alias, `${alias} (${tableName})`);
          }
          
          // 对于原表名，使用其本身作为显示名称
          if (!tableDisplayNames.has(tableName)) {
            tableDisplayNames.set(tableName, tableName);
          }
        }
      });
      
      // 处理JOIN
      let joinItems = [];
      if (sqlSelect.JOIN) {
        joinItems = sqlSelect.JOIN;
      } else if (sqlSelect.joins) {
        joinItems = sqlSelect.joins;
      }
      
      console.log('处理JOIN子句:', joinItems);
      
      joinItems.forEach(join => {
        let tableName = '';
        let alias = '';
        let joinCondition = null;
        
        // 处理不同解析器的JOIN结构
        if (join.table) {
          tableName = join.table;
          alias = join.as || '';
          joinCondition = join.ON;
        } else if (join.right && join.right.name) {
          tableName = join.right.name.value || join.right.name;
          if (join.right.alias) {
            alias = join.right.alias.value || join.right.alias;
          }
          if (join.on) {
            joinCondition = join.on;
          }
        }
        
        if (tableName) {
          tables.add(tableName);
          
          // 初始化表的字段集合
          if (!tableFields.has(tableName)) {
            tableFields.set(tableName, new Set());
          }
          
          // 记录表别名映射
          if (alias) {
            tableAliases.set(alias, tableName);
            if (!tableFields.has(alias)) {
              tableFields.set(alias, new Set());
            }
            
            // 存储表的显示名称 - 带别名格式
            tableDisplayNames.set(alias, `${alias} (${tableName})`);
          }
          
          // 对于原表名，使用其本身作为显示名称
          if (!tableDisplayNames.has(tableName)) {
            tableDisplayNames.set(tableName, tableName);
          }
        }
        
        // 处理JOIN关系
        if (joinCondition) {
          // 从joinCondition中提取连接关系
          const joinRelation = extractJoinRelation(joinCondition);
          if (joinRelation) {
            console.log('发现JOIN关系:', joinRelation);
            joinRelations.push(joinRelation);
            
            // 提取JOIN条件中出现的字段添加到对应表中
            if (joinRelation.leftTable && joinRelation.leftField) {
              const actualLeftTable = tableAliases.get(joinRelation.leftTable) || joinRelation.leftTable;
              if (tableFields.has(actualLeftTable)) {
                tableFields.get(actualLeftTable).add(joinRelation.leftField);
              }
              
              // 也添加到别名对应的表中
              if (tableFields.has(joinRelation.leftTable)) {
                tableFields.get(joinRelation.leftTable).add(joinRelation.leftField);
              }
              
              // 记录该字段是JOIN的连接字段
              joinRelations.push({
                table: actualLeftTable,
                field: joinRelation.leftField,
                tableAlias: joinRelation.leftTable !== actualLeftTable ? joinRelation.leftTable : null,
                targetTable: tableAliases.get(joinRelation.rightTable) || joinRelation.rightTable,
                targetField: joinRelation.rightField,
                targetTableAlias: joinRelation.rightTable !== (tableAliases.get(joinRelation.rightTable) || joinRelation.rightTable) ? joinRelation.rightTable : null,
                isSourceField: true
              });
            }
            
            if (joinRelation.rightTable && joinRelation.rightField) {
              const actualRightTable = tableAliases.get(joinRelation.rightTable) || joinRelation.rightTable;
              if (tableFields.has(actualRightTable)) {
                tableFields.get(actualRightTable).add(joinRelation.rightField);
              }
              
              // 也添加到别名对应的表中
              if (tableFields.has(joinRelation.rightTable)) {
                tableFields.get(joinRelation.rightTable).add(joinRelation.rightField);
              }
              
              // 记录该字段是JOIN的连接字段
              joinRelations.push({
                table: actualRightTable,
                field: joinRelation.rightField,
                tableAlias: joinRelation.rightTable !== actualRightTable ? joinRelation.rightTable : null,
                targetTable: tableAliases.get(joinRelation.leftTable) || joinRelation.leftTable,
                targetField: joinRelation.leftField,
                targetTableAlias: joinRelation.leftTable !== (tableAliases.get(joinRelation.leftTable) || joinRelation.leftTable) ? joinRelation.leftTable : null,
                isSourceField: false
              });
            }
          }
        }
      });
      
      // 如果没有找到JOIN关系但有多个表，直接为表创建连接
      if (joinRelations.length === 0 && tables.size > 1) {
        console.log('未找到JOIN关系但有多个表，尝试手动创建连接');
        
        // 为所有表创建连接
        const tableArray = Array.from(tables);
        for (let i = 0; i < tableArray.length - 1; i++) {
          const leftTable = tableArray[i];
          const rightTable = tableArray[i + 1];
          
          // 确保不是别名
          if (!tableAliases.has(leftTable) && !tableAliases.has(rightTable)) {
            console.log(`手动创建表连接: ${leftTable} -> ${rightTable}`);
            
            joinRelations.push({
              leftTable: leftTable,
              rightTable: rightTable,
              leftField: 'id', // 假设连接字段
              rightField: `${leftTable}_id`,
              condition: `${leftTable}.id = ${rightTable}.${leftTable}_id}`,
              leftTableOriginal: leftTable,
              rightTableOriginal: rightTable
            });
          }
        }
      }
      
      // 处理SELECT列
      let columns = [];
      if (sqlSelect.result_columns) {
        columns = sqlSelect.result_columns;
      } else if (sqlSelect.columns) {
        columns = sqlSelect.columns;
      }
      
      console.log('处理SELECT列:', columns);
      
      columns.forEach(column => {
        let tableName = '';
        let fieldName = '';
        let alias = column.as || ''; // 字段别名
        
        // 处理不同解析器的列结构
        if (column.expr && column.expr.column) {
          tableName = column.expr.table || '';
          fieldName = column.expr.column;
        } else if (column.expr && column.expr.type === 'column_ref') {
          if (column.expr.column.indexOf('.') > -1) {
            const parts = column.expr.column.split('.');
            tableName = parts[0];
            fieldName = parts[1];
          } else {
            fieldName = column.expr.column;
          }
        } else if (column.name) {
          // js-sql-parser格式
          if (column.name.indexOf('.') > -1) {
            const parts = column.name.split('.');
            tableName = parts[0];
            fieldName = parts[1];
          } else {
            fieldName = column.name;
          }
        }
        
        // 记录结果字段
        if (fieldName) {
          resultFields.add(fieldName);
          
          // 如果指定了表，将字段添加到表的字段集合中
          if (tableName) {
            // 检查是否是别名
            const actualTable = tableAliases.get(tableName) || tableName;
            
            // 添加到实际表
            if (tableFields.has(actualTable)) {
              tableFields.get(actualTable).add(fieldName);
            }
            
            // 添加到别名表
            if (tableFields.has(tableName)) {
              tableFields.get(tableName).add(fieldName);
            }
            
            // 保存字段显示名称
            const fieldId = `field:${actualTable}.${fieldName}`;
            if (tableName !== actualTable) {
              // 如果使用了别名，显示格式为：别名.字段名 (原表名.字段名)
              fieldDisplayNames.set(fieldId, `${tableName}.${fieldName} (${actualTable}.${fieldName})`);
            } else {
              // 如果没有使用别名，直接使用字段名
              fieldDisplayNames.set(fieldId, `${fieldName}`);
            }
            
            // 如果字段有别名
            if (alias) {
              fieldDisplayNames.set(fieldId, `${alias} (${tableName}.${fieldName})`);
            }
          } else {
            // 如果未指定表，尝试找出字段属于哪个表
            // 如果只有一个表，直接添加到该表
            if (tables.size === 1) {
              const singleTable = Array.from(tables)[0];
              tableFields.get(singleTable).add(fieldName);
              
              // 保存字段显示名称
              const fieldId = `field:${singleTable}.${fieldName}`;
              fieldDisplayNames.set(fieldId, fieldName);
              
              // 如果字段有别名
              if (alias) {
                fieldDisplayNames.set(fieldId, `${alias} (${fieldName})`);
              }
            }
          }
        }
      });
      
      // 处理WHERE子句中的字段
      if (sqlSelect.WHERE) {
        extractFieldsFromWhere(sqlSelect.WHERE);
      } else if (sqlSelect.where) {
        extractFieldsFromWhere(sqlSelect.where);
      }
      
      // 在节点创建前，合并别名表的字段到实际表
      tableAliases.forEach((realTable, alias) => {
        if (tableFields.has(alias) && tableFields.has(realTable)) {
          const aliasFields = tableFields.get(alias);
          const realTableFields = tableFields.get(realTable);
          
          aliasFields.forEach(field => {
            realTableFields.add(field);
          });
        }
      });
      
      // 创建节点和链接
      // 1. 首先创建表节点
      console.log('创建表节点，表数量:', tables.size);
      tables.forEach(table => {
        // 不为别名创建表节点
        if (!tableAliases.has(table)) {
          const displayName = tableDisplayNames.get(table) || table;
          graphData.nodes.push({
            id: `table:${table}`,
            name: displayName,
            originalName: table,
            type: 'table'
          });
        }
      });
      
      // 同时为别名创建表节点，并链接到原表
      tableAliases.forEach((realTable, alias) => {
        const displayName = tableDisplayNames.get(alias) || `${alias} (${realTable})`;
        graphData.nodes.push({
          id: `table:${alias}`,
          name: displayName,
          originalName: realTable,
          isAlias: true,
          aliasFor: realTable,
          type: 'table'
        });
        
        // 添加别名到实际表的连接
        graphData.links.push({
          source: `table:${alias}`,
          target: `table:${realTable}`,
          type: 'alias-table',
          isAliasLink: true
        });
      });
      
      // 2. 创建字段节点
      console.log('表的字段:', tableFields);
      tableFields.forEach((fields, tableName) => {
        // 跳过别名表的字段节点创建
        if (tableAliases.has(tableName)) {
          return;
        }
        
        fields.forEach(field => {
          // 判断是否为结果字段
          const isResultField = resultFields.has(field);
          
          // 判断是否为连接字段
          const isJoinField = joinRelations.some(relation => 
            (relation.table === tableName && relation.field === field)
          );
          
          // 如果是连接字段，查找连接到的目标表和字段
          let joinTarget = null;
          if (isJoinField) {
            joinTarget = joinRelations.find(relation => 
              relation.table === tableName && relation.field === field
            );
          }
          
          // 获取字段显示名称
          const fieldId = `field:${tableName}.${field}`;
          const displayName = fieldDisplayNames.get(fieldId) || field;
          
          graphData.nodes.push({
            id: fieldId,
            name: displayName,
            originalName: field,
            type: 'field',
            table: tableName,
            isResult: isResultField,
            isJoinField: isJoinField,
            joinTarget: joinTarget // 添加连接目标信息
          });
          
          // 添加字段到表的链接
          graphData.links.push({
            source: fieldId,
            target: `table:${tableName}`,
            type: 'field-table'
          });
        });
      });
      
      // 3. 添加表之间的JOIN关系链接
      console.log('处理JOIN关系，关系数:', joinRelations.length);
      
      // 保存处理过的表对，避免重复
      const processedTablePairs = new Set();
      
      // 先处理原表之间的JOIN关系
      joinRelations.forEach(relation => {
        console.log('处理JOIN关系:', relation);
        
        // 只处理leftTable和rightTable都存在的关系，且是原始的JOIN关系
        if (!relation.leftTable || !relation.rightTable || 
            relation.isSourceField !== undefined) {
          console.log('   跳过: 非原始JOIN关系或缺少表信息');
          return;
        }
        
        const sourceTable = tableAliases.get(relation.leftTable) || relation.leftTable;
        const targetTable = tableAliases.get(relation.rightTable) || relation.rightTable;
        
        console.log(`   映射: ${relation.leftTable} -> ${sourceTable}, ${relation.rightTable} -> ${targetTable}`);
        
        // 避免重复处理同一对表
        const tablePairKey = [sourceTable, targetTable].sort().join(':');
        if (processedTablePairs.has(tablePairKey)) {
          console.log(`   跳过: 表对已处理 ${tablePairKey}`);
          return;
        }
        processedTablePairs.add(tablePairKey);
        
        // 处理表连接，使用原表而不是别名
        const sourceId = `table:${sourceTable}`;
        const targetId = `table:${targetTable}`;
        
        console.log(`   创建表连接: ${sourceId} -> ${targetId}`);
        
        // 直接添加表间连接
        graphData.links.push({
          source: sourceId,
          target: targetId,
          type: 'table-join',
          condition: relation.condition || 'JOIN'
        });
        
        // 如果有连接字段，添加字段之间的连接
        if (relation.leftField && relation.rightField) {
          const sourceField = `field:${sourceTable}.${relation.leftField}`;
          const targetField = `field:${targetTable}.${relation.rightField}`;
          
          // 检查这两个字段节点是否存在
          const sourceFieldExists = graphData.nodes.some(node => node.id === sourceField);
          const targetFieldExists = graphData.nodes.some(node => node.id === targetField);
          
          // 如果字段节点不存在，尝试创建它们
          if (!sourceFieldExists && tableFields.has(sourceTable) && !tableFields.get(sourceTable).has(relation.leftField)) {
            // 添加连接字段到字段集合
            tableFields.get(sourceTable).add(relation.leftField);
            
            // 添加节点
            graphData.nodes.push({
              id: sourceField,
              name: relation.leftField,
              originalName: relation.leftField,
              type: 'field',
              table: sourceTable,
              isResult: resultFields.has(relation.leftField),
              isJoinField: true // 标记为连接字段
            });
            
            // 添加字段到表的连接
            graphData.links.push({
              source: sourceField,
              target: sourceId,
              type: 'field-table'
            });
          }
          
          if (!targetFieldExists && tableFields.has(targetTable) && !tableFields.get(targetTable).has(relation.rightField)) {
            // 添加连接字段到字段集合
            tableFields.get(targetTable).add(relation.rightField);
            
            // 添加节点
            graphData.nodes.push({
              id: targetField,
              name: relation.rightField,
              originalName: relation.rightField,
              type: 'field',
              table: targetTable,
              isResult: resultFields.has(relation.rightField),
              isJoinField: true // 标记为连接字段
            });
            
            // 添加字段到表的连接
            graphData.links.push({
              source: targetField,
              target: targetId,
              type: 'field-table'
            });
          }
          
          // 重新检查字段是否存在（可能已创建）
          const sourceFieldNowExists = graphData.nodes.some(node => node.id === sourceField);
          const targetFieldNowExists = graphData.nodes.some(node => node.id === targetField);
          
          if (sourceFieldNowExists && targetFieldNowExists) {
            // 添加字段间的连接线
            graphData.links.push({
              source: sourceField,
              target: targetField,
              type: 'field-join',
              condition: relation.condition
            });
          }
        } else {
          console.log('   跳过: 表名无效或缺少字段信息');
        }
      });
      
      // 如果也使用了别名，为别名表添加连接关系
      if (tableAliases.size > 0) {
        joinRelations.forEach(relation => {
          // 只处理带有别名的连接信息
          if (relation.tableAlias) {
            const sourceTable = relation.table;
            const sourceField = relation.field;
            const targetTable = relation.targetTable;
            const targetField = relation.targetField;
            
            // 创建别名表到目标表的连接
            if (relation.tableAlias && relation.targetTableAlias) {
              // 如果源表和目标表都有别名
              const aliasTablePairKey = [relation.tableAlias, relation.targetTableAlias].sort().join(':');
              if (!processedTablePairs.has(aliasTablePairKey)) {
                processedTablePairs.add(aliasTablePairKey);
                
                graphData.links.push({
                  source: `table:${relation.tableAlias}`,
                  target: `table:${relation.targetTableAlias}`,
                  type: 'table-join',
                  condition: `${relation.tableAlias}.${sourceField} = ${relation.targetTableAlias}.${targetField}`,
                  isAliasJoin: true
                });
              }
            } else if (relation.tableAlias) {
              // 如果只有源表有别名
              const aliasTablePairKey = [relation.tableAlias, targetTable].sort().join(':');
              if (!processedTablePairs.has(aliasTablePairKey) && relation.tableAlias !== targetTable) {
                processedTablePairs.add(aliasTablePairKey);
                
                graphData.links.push({
                  source: `table:${relation.tableAlias}`,
                  target: `table:${targetTable}`,
                  type: 'table-join',
                  condition: `${relation.tableAlias}.${sourceField} = ${targetTable}.${targetField}`,
                  isAliasJoin: true
                });
              }
            } else if (relation.targetTableAlias) {
              // 如果只有目标表有别名
              const aliasTablePairKey = [sourceTable, relation.targetTableAlias].sort().join(':');
              if (!processedTablePairs.has(aliasTablePairKey) && sourceTable !== relation.targetTableAlias) {
                processedTablePairs.add(aliasTablePairKey);
                
                graphData.links.push({
                  source: `table:${sourceTable}`,
                  target: `table:${relation.targetTableAlias}`,
                  type: 'table-join',
                  condition: `${sourceTable}.${sourceField} = ${relation.targetTableAlias}.${targetField}`,
                  isAliasJoin: true
                });
              }
            }
          }
        });
      }
      
      // 打印生成的连接
      console.log('表连接数:', graphData.links.filter(link => link.type === 'table-join').length);
      console.log('表连接:', graphData.links.filter(link => link.type === 'table-join'));
      
      // 如果没有找到任何节点，创建一个默认节点
      if (graphData.nodes.length === 0) {
        console.log('未找到表或字段，创建默认节点');
        // 创建一个默认表
        const genericTableId = 'table:查询结果';
        graphData.nodes.push({
          id: genericTableId,
          name: '查询结果',
          originalName: '查询结果',
          type: 'table'
        });
        
        // 创建一个默认字段
        graphData.nodes.push({
          id: 'field:数据',
          name: '数据',
          originalName: '数据',
          type: 'field',
          isResult: true
        });
        
        // 创建一个连接
        graphData.links.push({
          source: 'field:数据',
          target: genericTableId,
          type: 'field-table'
        });
      }
      
      console.log('生成的图表数据:', graphData);
      return graphData;
    } catch (error) {
      console.error('生成图数据错误:', error);
      
      // 创建一个错误节点作为备选方案
      const errorTableId = 'table:解析错误';
      graphData.nodes.push({
        id: errorTableId,
        name: '解析错误',
        originalName: '解析错误',
        type: 'table'
      });
      
      graphData.nodes.push({
        id: 'field:错误信息',
        name: error.message,
        originalName: error.message,
        type: 'field',
        isResult: true
      });
      
      graphData.links.push({
        source: 'field:错误信息',
        target: errorTableId,
        type: 'field-table'
      });
      
      return graphData;
    }
  }

  /**
   * 渲染关系图
   * @param {Object} data - 图数据结构
   */
  function renderGraph(data) {
    // 添加调试信息
    console.log('渲染图表数据:', data);
    console.log('表连接数量:', data.links.filter(link => link.type === 'table-join').length);
    
    // 检查数据是否为空
    if (!data.nodes || data.nodes.length === 0) {
      console.error('图表数据为空');
      showError('无法生成关系图：未能从SQL中提取表和字段信息');
      return;
    }
    
    // 清空图容器
    graphElement.innerHTML = '';
    
    const width = graphElement.clientWidth || 600; // 设置默认宽度
    const height = 700;  // 从500px增加到700px
    
    console.log('图表容器尺寸:', width, height);
    
    // 创建图例
    const legendContainer = document.createElement('div');
    legendContainer.className = 'legend flex flex-wrap justify-center gap-4 mb-4';
    legendContainer.innerHTML = `
      <div class="flex items-center">
        <span class="inline-block w-4 h-4 rounded-full mr-2 bg-blue-600"></span>
        <span>表</span>
      </div>
      <div class="flex items-center">
        <span class="inline-block w-4 h-4 rounded-full mr-2 bg-purple-500"></span>
        <span>表别名</span>
      </div>
      <div class="flex items-center">
        <span class="inline-block w-4 h-4 rounded-full mr-2 bg-blue-300"></span>
        <span>普通字段</span>
      </div>
      <div class="flex items-center">
        <span class="inline-block w-4 h-4 rounded-full mr-2 bg-green-500"></span>
        <span>结果字段</span>
      </div>
      <div class="flex items-center">
        <span class="inline-block w-4 h-4 border-b-2 border-blue-600 mr-2"></span>
        <span>字段归属</span>
      </div>
      <div class="flex items-center">
        <span class="inline-block w-4 h-4 border-b-2 border-red-500 mr-2"></span>
        <span>表连接</span>
      </div>
      <div class="flex items-center">
        <span class="inline-block w-4 h-4 border-b-2 border-dashed border-green-500 mr-2"></span>
        <span>字段连接</span>
      </div>
      <div class="flex items-center">
        <span class="inline-block w-4 h-4 border-b-2 border-dashed border-purple-500 mr-2"></span>
        <span>别名关系</span>
      </div>
    `;
    
    graphElement.appendChild(legendContainer);
    
    // 创建SVG容器
    const svgContainer = document.createElement('div');
    svgContainer.className = 'svg-container';
    svgContainer.style.height = '700px';  // 从500px增加到700px
    graphElement.appendChild(svgContainer);
    
    // 创建SVG
    const svg = d3.select(svgContainer)
      .append("svg")
      .attr("width", width)
      .attr("height", 700)  // 从height变量(500)增加到700px
      .call(d3.zoom()
        .scaleExtent([0.3, 3]) // 设置缩放范围
        .on("zoom", function(event) {
          g.attr("transform", event.transform);
        }))
      .append("g");
    
    const g = svg.append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2}) scale(0.8)`); // 添加初始缩放
    
    // 添加缩放提示
    svg.append("text")
      .attr("x", 10)
      .attr("y", 20)
      .attr("class", "zoom-hint")
      .text("可使用鼠标滚轮缩放图表")
      .style("font-size", "12px")
      .style("fill", "black");
    
    // 按类型分组链接
    const fieldTableLinks = data.links.filter(link => link.type === 'field-table');
    const tableJoinLinks = data.links.filter(link => link.type === 'table-join');
    const fieldJoinLinks = data.links.filter(link => link.type === 'field-join');
    const aliasLinks = data.links.filter(link => link.type === 'alias-table' || link.isAliasLink);
    
    console.log('表连接links:', tableJoinLinks);
    console.log('别名links:', aliasLinks);
    
    // 创建连接线分组 - 先创建分组
    const linkGroup = g.append("g").attr("class", "links");
    const tableJoinG = linkGroup.append("g").attr("class", "table-join-links");
    const fieldTableG = linkGroup.append("g").attr("class", "field-table-links");
    const fieldJoinG = linkGroup.append("g").attr("class", "field-join-links");
    const aliasLinkG = linkGroup.append("g").attr("class", "alias-links");
    
    // 先创建所有连接线元素，但不设置属性
    // 绘制表之间的连接线（放在最上层）
    const tableJoinLinkElements = tableJoinG.selectAll(".link-table-join")
      .data(tableJoinLinks)
      .enter()
      .append("line")
      .attr("class", "link link-table-join")
      .style("stroke", l => l.isAliasJoin ? "#9c27b0" : "#ef4444")  // 别名连接使用紫色
      .style("stroke-width", 6)    // 更粗的线
      .style("opacity", l => l.isAliasJoin ? 0.6 : 1);  // 别名连接稍微透明
    
    // 绘制字段到表的连接线
    const fieldTableLinkElements = fieldTableG.selectAll(".link-field-table")
      .data(fieldTableLinks)
      .enter()
      .append("line")
      .attr("class", "link link-field-table")
      .style("stroke", "#3b82f6")  // 蓝色
      .style("stroke-width", 1.5); // 较细的线
    
    // 绘制字段到字段的连接线
    const fieldJoinLinkElements = fieldJoinG.selectAll(".link-field-join")
      .data(fieldJoinLinks)
      .enter()
      .append("line")
      .attr("class", "link link-field-join")
      .style("stroke", "#22c55e")  // 绿色
      .style("stroke-width", 2)    // 中等粗细
      .style("stroke-dasharray", "4,4"); // 虚线
      
    // 绘制别名关系连接线
    const aliasLinkElements = aliasLinkG.selectAll(".link-alias")
      .data(aliasLinks)
      .enter()
      .append("line")
      .attr("class", "link link-alias")
      .style("stroke", "#9c27b0")  // 紫色
      .style("stroke-width", 2)    // 中等粗细
      .style("stroke-dasharray", "2,2"); // 虚线
    
    // 然后创建节点
    const nodes = g.append("g")
      .selectAll(".node")
      .data(data.nodes)
      .enter()
      .append("g")
      .attr("class", d => {
        let className = "node";
        if (d.type === 'table') {
          className += " table-node";
        } else if (d.type === 'field') {
          className += " field-node";
          if (d.isResult) {
            className += " result-field-node";
          }
          if (d.isJoinField) {
            className += " join-field-node";
          }
        }
        return className;
      })
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));
    
    // 为节点添加圆角矩形
    nodes.append("rect")
      .attr("rx", d => d.type === 'table' ? 8 : 5) // 圆角大小
      .attr("ry", d => d.type === 'table' ? 8 : 5)
      .attr("width", function(d) {
        // 根据文本长度计算宽度
        const textLength = d.name.length;
        if (d.type === 'table') {
          return Math.max(120, textLength * 10); // 表名最小宽度120px
        } else {
          return Math.max(80, textLength * 8); // 字段名最小宽度80px
        }
      })
      .attr("height", d => d.type === 'table' ? 50 : 30) // 高度固定
      .attr("x", function(d) {
        // x坐标居中偏移
        const width = d3.select(this).attr("width");
        return -width / 2;
      })
      .attr("y", function(d) {
        // y坐标居中偏移
        const height = d3.select(this).attr("height");
        return -height / 2;
      })
      .style("fill", d => {
        if (d.type === 'table') {
          if (d.isAlias) return "#9c27b0"; // 表别名：紫色
          return "#2563eb"; // 表：蓝色
        }
        if (d.type === 'field') {
          if (d.isResult) return "#22c55e"; // 结果字段：绿色
          return "#93c5fd"; // 普通字段(包括连接字段)：浅蓝色
        }
        return "#93c5fd";
      })
      .style("stroke", d => {
        if (d.type === 'table') {
          if (d.isAlias) return "#7b1fa2"; // 表别名边框：深紫色
          return "#1e40af"; // 表边框：深蓝色
        }
        if (d.type === 'field') {
          if (d.isResult) return "#16a34a"; // 结果字段边框：深绿色
          return "#3b82f6"; // 普通字段边框：蓝色
        }
        return "#3b82f6";
      })
      .style("stroke-width", d => {
        return d.type === 'table' ? 2.5 : 2;
      })
      .each(function(d) {
        if (d.isJoinField) {
          d3.select(this)
            .style("filter", "none");
        }
      });
    
    // 为节点添加文本
    nodes.append("text")
      .attr("dy", "0.3em") // 垂直居中
      .attr("text-anchor", "middle")
      .style("fill", "black")
      .style("font-size", d => d.type === 'table' ? "14px" : "12px")
      .style("font-weight", d => (d.type === 'table' || d.isResult || d.isJoinField) ? "bold" : "normal")
      .style("pointer-events", "none")
      .text(d => d.name);
    
    // 为连接字段添加"ON"标识
    nodes.filter(d => d.isJoinField)
      .append("text")
      .attr("class", "on-label")
      .attr("y", d => d.type === 'table' ? -30 : -20)
      .attr("text-anchor", "middle")
      .text("")  // 将"ON"文本改为空字符串
      .style("fill", "black") // 从"#ef4444"改为"black"
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("pointer-events", "none");
    
    // 添加悬停交互，增强连接字段的可视化效果
    nodes.on("mouseover", function(event, d) {
      // 放大节点
      const node = d3.select(this);
      const rect = node.select("rect");
      const originalWidth = parseFloat(rect.attr("width"));
      const originalHeight = parseFloat(rect.attr("height"));
      
      rect.transition()
        .duration(200)
        .attr("width", originalWidth * 1.1)
        .attr("height", originalHeight * 1.1)
        .attr("x", -originalWidth * 1.1 / 2)
        .attr("y", -originalHeight * 1.1 / 2);
      
      // 高亮相关连接
      if (d.type === 'table') {
        // 高亮连接到该表的所有连接
        linkGroup.selectAll("line")
          .style("opacity", l => 
            (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.2
          );
          
        // 高亮属于该表的字段
        nodes.filter(n => n.type === 'field' && n.table === d.name)
          .select("rect")
          .style("stroke-width", 3)
          .style("filter", "drop-shadow(0px 0px 5px rgba(59, 130, 246, 0.5))");
      } else if (d.type === 'field') {
        // 高亮与该字段相关的所有连接
        linkGroup.selectAll("line")
          .style("opacity", l => 
            (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.2
          );
          
        // 修改：不再为连接字段添加特殊高亮效果
        if (d.isJoinField) {
          // 找到与此字段相连的字段连接
          const relatedLinks = fieldJoinLinks.filter(link => 
            link.source === d.id || link.target === d.id
          );
          
          // 高亮相关的字段节点，但使用普通字段的高亮样式
          relatedLinks.forEach(link => {
            const relatedNodeId = link.source === d.id ? link.target : link.source;
            const relatedNode = nodes.filter(node => node.datum().id === relatedNodeId);
            
            if (!relatedNode.empty()) {
              relatedNode.select("rect")
                .transition()
                .duration(200)
                .style("fill", "#60a5fa") // 使用普通字段高亮色
                .style("stroke", "#3b82f6")
                .style("stroke-width", 3)
                .style("filter", "drop-shadow(0px 0px 5px rgba(59, 130, 246, 0.5))");
            }
          });
          
          // ... keep ON label highlighting ...
        }
      }
      
      // 显示提示信息
      const tooltip = d3.select("#tooltip");
      let tooltipContent = '';
      
      if (d.type === 'table') {
        tooltipContent = `<strong>表:</strong> ${d.name}`;
      } else if (d.type === 'field') {
        tooltipContent = `<strong>字段:</strong> ${d.name}`;
        if (d.table) {
          tooltipContent += `<br><strong>所属表:</strong> ${d.table}`;
        }
        if (d.isResult) {
          tooltipContent += `<br><strong>查询结果字段</strong>`;
        }
        if (d.isJoinField) {
          tooltipContent += `<br><strong>表连接字段</strong>`;
          // 如果有连接目标信息，添加到提示中
          if (d.joinTarget) {
            tooltipContent += `<br><strong>连接到:</strong> ${d.joinTarget.targetTable}.${d.joinTarget.targetField}`;
          }
        }
      }
      
      tooltip
        .html(tooltipContent)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px")
        .style("opacity", 1);
    })
    .on("mouseout", function(event, d) {
      // 恢复节点大小
      const node = d3.select(this);
      const rect = node.select("rect");
      const width = d.type === 'table' ? 
        Math.max(120, d.name.length * 10) : 
        Math.max(80, d.name.length * 8);
      const height = d.type === 'table' ? 50 : 30;
      
      rect.transition()
        .duration(200)
        .attr("width", width)
        .attr("height", height)
        .attr("x", -width / 2)
        .attr("y", -height / 2);
      
      // 恢复所有连接的不透明度
      linkGroup.selectAll("line")
        .style("opacity", 1);
      
      // 恢复所有节点的样式
      nodes.select("rect")
        .transition()
        .duration(200)
        .style("fill", d => {
          if (d.type === 'table') return "#2563eb"; // 蓝色
          if (d.type === 'field') {
            if (d.isResult) return "#22c55e"; // 结果字段：绿色
            return "#93c5fd"; // 普通字段：浅蓝色
          }
          return "#93c5fd";
        })
        .style("stroke", d => {
          if (d.type === 'table') return "#1e40af"; // 深蓝色
          if (d.type === 'field') {
            if (d.isResult) return "#16a34a"; // 深绿色
            return "#3b82f6"; // 蓝色
          }
          return "#3b82f6";
        })
        .style("stroke-width", d => {
          return d.type === 'table' ? 2.5 : 2;
        })
        .style("filter", "none");
      
      // 恢复ON标签
      nodes.select(".on-label")
        .transition()
        .duration(200)
        .style("font-size", "12px")
        .style("fill", "black"); // 从"#ef4444"改为"black"
        
      // 恢复连接线上的ON标签
      d3.selectAll(".field-join-label")
        .transition()
        .duration(200)
        .style("font-size", "14px")
        .style("fill", "black");
        
      // 恢复连接标签背景
      d3.selectAll(".field-join-label-bg")
        .transition()
        .duration(200)
        .attr("fill", "rgba(255, 255, 255, 0.9)")
        .attr("stroke-width", 1.5)
        .attr("width", 36)
        .attr("height", 24)
        .attr("x", function() { 
          const currX = parseFloat(d3.select(this).attr("x"));
          const currWidth = parseFloat(d3.select(this).attr("width"));
          // 恢复原始宽度和位置
          if (currWidth > 36) {
            return currX + 2;
          }
          return currX;
        })
        .attr("y", function() { 
          const currY = parseFloat(d3.select(this).attr("y"));
          const currHeight = parseFloat(d3.select(this).attr("height"));
          // 恢复原始高度和位置
          if (currHeight > 24) {
            return currY + 2;
          }
          return currY;
        });
      
      // 隐藏提示
      d3.select("#tooltip").style("opacity", 0);
    });
    
    // 创建提示框
    if (!document.getElementById("tooltip")) {
      const tooltip = d3.select("body").append("div")
        .attr("id", "tooltip")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("padding", "5px")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", 1000);
    }
    
    // 创建力导向布局
    const simulation = d3.forceSimulation(data.nodes)
      .force("link", d3.forceLink(data.links).id(d => d.id).distance(d => {
        // 表之间的距离更短，使连接更容易看到
        if (d.type === 'table-join') return 300; // 从180增加到300
        if (d.type === 'field-join') return 200; // 从100增加到200
        return 180; // 从120增加到180
      }))
      .force("charge", d3.forceManyBody().strength(d => {
        // 表的排斥力调整
        if (d.type === 'table') return -1000; // 从-600增加到-1000
        if (d.type === 'field' && d.isResult) return -600; // 从-400增加到-600
        if (d.type === 'field' && d.isJoinField) return -500; // 从-350增加到-500
        return -400; // 从-300增加到-400
      }))
      .force("center", d3.forceCenter(0, 0))
      .force("collision", d3.forceCollide().radius(d => {
        // 根据节点的实际大小调整碰撞半径
        if (d.type === 'table') {
          const width = Math.max(120, d.name.length * 10);
          const height = 50;
          return Math.sqrt(width*width + height*height) / 2 * 1.5; // 增加碰撞半径
        } else {
          const width = Math.max(80, d.name.length * 8);
          const height = 30;
          return Math.sqrt(width*width + height*height) / 2 * 1.3; // 增加碰撞半径
        }
      }));
    
    // 初始化节点位置
    // 表放在中心周围，字段围绕各自的表
    data.nodes.forEach(node => {
      if (node.type === 'table' && !node.isAlias) {
        const angle = Math.random() * 2 * Math.PI;
        const radius = 200; // 从100增加到200
        node.x = Math.cos(angle) * radius;
        node.y = Math.sin(angle) * radius;
      } else if (node.type === 'table' && node.isAlias) {
        // 找到原表节点
        const originalTable = data.nodes.find(n => 
          n.type === 'table' && n.originalName === node.aliasFor && !n.isAlias
        );
        
        if (originalTable && originalTable.x !== undefined && originalTable.y !== undefined) {
          // 在原表附近放置别名表
          const angle = Math.random() * 2 * Math.PI;
          const radius = 80; // 较小的半径，让别名表靠近原表
          node.x = originalTable.x + Math.cos(angle) * radius;
          node.y = originalTable.y + Math.sin(angle) * radius;
        } else {
          // 如果找不到原表，放在随机位置
          const angle = Math.random() * 2 * Math.PI;
          const radius = 200;
          node.x = Math.cos(angle) * radius;
          node.y = Math.sin(angle) * radius;
        }
      } else if (node.type === 'field') {
        // 找到字段所属的表节点
        const tableNode = data.nodes.find(n => 
          n.type === 'table' && n.originalName === node.table && !n.isAlias
        );
        
        if (tableNode && tableNode.x !== undefined && tableNode.y !== undefined) {
          // 在表节点周围随机位置
          const angle = Math.random() * 2 * Math.PI;
          const radius = node.isResult ? 140 : (node.isJoinField ? 130 : 100); // 分别从70,65,50增加到140,130,100
          node.x = tableNode.x + Math.cos(angle) * radius;
          node.y = tableNode.y + Math.sin(angle) * radius;
        } else {
          // 如果找不到表节点，随机位置
          node.x = (Math.random() - 0.5) * 400; // 从200增加到400
          node.y = (Math.random() - 0.5) * 400; // 从200增加到400
        }
      }
    });
    
    // 更新布局
    simulation.on("tick", () => {
      // 获取每个节点的矩形尺寸
      const nodeRects = {};
      nodes.each(function(d) {
        const rect = d3.select(this).select("rect");
        nodeRects[d.id] = {
          width: parseFloat(rect.attr("width")),
          height: parseFloat(rect.attr("height"))
        };
      });
    
      // 更新表连接线 - 确保连接线显示在最顶层
      tableJoinLinkElements
        .attr("x1", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!sourceNode || !sourceNode.x) return 0;
          
          const sourceRect = nodeRects[sourceNode.id];
          if (!sourceRect) return sourceNode.x;
          
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const angle = Math.atan2(dy, dx);
          
          return sourceNode.x + Math.cos(angle) * sourceRect.width/2;
        })
        .attr("y1", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!sourceNode || !sourceNode.y) return 0;
          
          const sourceRect = nodeRects[sourceNode.id];
          if (!sourceRect) return sourceNode.y;
          
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const angle = Math.atan2(dy, dx);
          
          return sourceNode.y + Math.sin(angle) * sourceRect.height/2;
        })
        .attr("x2", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!targetNode || !targetNode.x) return width;
          
          const targetRect = nodeRects[targetNode.id];
          if (!targetRect) return targetNode.x;
          
          const dx = sourceNode.x - targetNode.x;
          const dy = sourceNode.y - targetNode.y;
          const angle = Math.atan2(dy, dx);
          
          return targetNode.x + Math.cos(angle) * targetRect.width/2;
        })
        .attr("y2", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!targetNode || !targetNode.y) return height;
          
          const targetRect = nodeRects[targetNode.id];
          if (!targetRect) return targetNode.y;
          
          const dx = sourceNode.x - targetNode.x;
          const dy = sourceNode.y - targetNode.y;
          const angle = Math.atan2(dy, dx);
          
          return targetNode.y + Math.sin(angle) * targetRect.height/2;
        });
      
      // 更新字段到表连接线
      fieldTableLinkElements
        .attr("x1", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!sourceNode || !sourceNode.x) return 0;
          
          const sourceRect = nodeRects[sourceNode.id];
          if (!sourceRect) return sourceNode.x;
          
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const angle = Math.atan2(dy, dx);
          
          return sourceNode.x + Math.cos(angle) * sourceRect.width/2;
        })
        .attr("y1", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!sourceNode || !sourceNode.y) return 0;
          
          const sourceRect = nodeRects[sourceNode.id];
          if (!sourceRect) return sourceNode.y;
          
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const angle = Math.atan2(dy, dx);
          
          return sourceNode.y + Math.sin(angle) * sourceRect.height/2;
        })
        .attr("x2", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!targetNode || !targetNode.x) return width;
          
          const targetRect = nodeRects[targetNode.id];
          if (!targetRect) return targetNode.x;
          
          const dx = sourceNode.x - targetNode.x;
          const dy = sourceNode.y - targetNode.y;
          const angle = Math.atan2(dy, dx);
          
          return targetNode.x + Math.cos(angle) * targetRect.width/2;
        })
        .attr("y2", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!targetNode || !targetNode.y) return height;
          
          const targetRect = nodeRects[targetNode.id];
          if (!targetRect) return targetNode.y;
          
          const dx = sourceNode.x - targetNode.x;
          const dy = sourceNode.y - targetNode.y;
          const angle = Math.atan2(dy, dx);
          
          return targetNode.y + Math.sin(angle) * targetRect.height/2;
        });
      
      // 更新字段间连接线
      fieldJoinLinkElements
        .attr("x1", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!sourceNode || !sourceNode.x) return 0;
          
          const sourceRect = nodeRects[sourceNode.id];
          if (!sourceRect) return sourceNode.x;
          
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const angle = Math.atan2(dy, dx);
          
          return sourceNode.x + Math.cos(angle) * sourceRect.width/2;
        })
        .attr("y1", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!sourceNode || !sourceNode.y) return 0;
          
          const sourceRect = nodeRects[sourceNode.id];
          if (!sourceRect) return sourceNode.y;
          
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const angle = Math.atan2(dy, dx);
          
          return sourceNode.y + Math.sin(angle) * sourceRect.height/2;
        })
        .attr("x2", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!targetNode || !targetNode.x) return width;
          
          const targetRect = nodeRects[targetNode.id];
          if (!targetRect) return targetNode.x;
          
          const dx = sourceNode.x - targetNode.x;
          const dy = sourceNode.y - targetNode.y;
          const angle = Math.atan2(dy, dx);
          
          return targetNode.x + Math.cos(angle) * targetRect.width/2;
        })
        .attr("y2", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!targetNode || !targetNode.y) return height;
          
          const targetRect = nodeRects[targetNode.id];
          if (!targetRect) return targetNode.y;
          
          const dx = sourceNode.x - targetNode.x;
          const dy = sourceNode.y - targetNode.y;
          const angle = Math.atan2(dy, dx);
          
          return targetNode.y + Math.sin(angle) * targetRect.height/2;
        });
        
      // 更新别名连接线
      aliasLinkElements
        .attr("x1", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!sourceNode || !sourceNode.x) return 0;
          
          const sourceRect = nodeRects[sourceNode.id];
          if (!sourceRect) return sourceNode.x;
          
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const angle = Math.atan2(dy, dx);
          
          return sourceNode.x + Math.cos(angle) * sourceRect.width/2;
        })
        .attr("y1", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!sourceNode || !sourceNode.y) return 0;
          
          const sourceRect = nodeRects[sourceNode.id];
          if (!sourceRect) return sourceNode.y;
          
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const angle = Math.atan2(dy, dx);
          
          return sourceNode.y + Math.sin(angle) * sourceRect.height/2;
        })
        .attr("x2", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!targetNode || !targetNode.x) return width;
          
          const targetRect = nodeRects[targetNode.id];
          if (!targetRect) return targetNode.x;
          
          const dx = sourceNode.x - targetNode.x;
          const dy = sourceNode.y - targetNode.y;
          const angle = Math.atan2(dy, dx);
          
          return targetNode.x + Math.cos(angle) * targetRect.width/2;
        })
        .attr("y2", d => {
          const sourceNode = d.source;
          const targetNode = d.target;
          
          if (!targetNode || !targetNode.y) return height;
          
          const targetRect = nodeRects[targetNode.id];
          if (!targetRect) return targetNode.y;
          
          const dx = sourceNode.x - targetNode.x;
          const dy = sourceNode.y - targetNode.y;
          const angle = Math.atan2(dy, dx);
          
          return targetNode.y + Math.sin(angle) * targetRect.height/2;
        });
      
      
      // 更新节点位置
      nodes.attr("transform", d => `translate(${d.x}, ${d.y})`);
    });
    
    // 手动触发几次tick，确保布局立即更新
    for (let i = 0; i < 20; i++) {
      simulation.tick();
    }
    
    // 拖拽事件处理函数
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  }

  // 显示错误信息
  function showError(message) {
    errorMessageElement.textContent = message;
    errorMessageElement.classList.remove('hidden');
  }
  
  // 隐藏错误信息
  function hideError() {
    errorMessageElement.classList.add('hidden');
  }
  
  // 显示加载状态
  function showLoading() {
    loadingElement.classList.remove('hidden');
  }
  
  // 隐藏加载状态
  function hideLoading() {
    loadingElement.classList.add('hidden');
  }
}); 